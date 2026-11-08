import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { loadSiteConfig } from "../scripts/lib/site-config.mjs";

const source = readFileSync(new URL("../js/analytics.js", import.meta.url), "utf8");
const origin = loadSiteConfig().canonicalOrigin;

function browser(consent = "", path = "/tienda", options = {}) {
  const listeners = {};
  const nodes = new Map();
  const store = new Map([["cl_analytics_consent_v1", consent]]);
  function node(tag) {
    return { tagName: tag, children: [], attrs: {}, setAttribute(k,v) { this.attrs[k]=v; }, getAttribute(k) { return this.attrs[k] || null; },
      append(...els) { this.children.push(...els); for (const el of els) if (el.id) nodes.set(el.id, el); }, appendChild(el) { this.append(el); },
      addEventListener(name, fn) { this[name] = fn; }, remove() { nodes.delete(this.id); }, querySelectorAll() { return []; } };
  }
  const document = { title: "Tienda", readyState: "complete", visibilityState: "visible", referrer: "https://example.com/entry?secret=hidden",
    head: node("head"), body: node("body"), documentElement: { scrollHeight: 2000, clientHeight: 500 }, cookie: "",
    createElement: node, getElementById(id) { return nodes.get(id); }, querySelectorAll(selector) { return options.targets ? options.targets(selector) : []; }, querySelector() { return null; },
    addEventListener(name,fn) { (listeners[name] ||= []).push(fn); }, dispatchEvent(event) { for (const fn of listeners[event.type] || []) fn(event); } };
  const window = { document, location: new URL(`${origin}${path}?utm_source=instagram&utm_medium=social&utm_campaign=noviembre&email=private#secret`),
    localStorage: { getItem(k) { return store.get(k); }, setItem(k,v) { store.set(k,v); } }, scrollY: 0, innerHeight: 500,
    addEventListener(name,fn) { (listeners[name] ||= []).push(fn); }, setInterval() {}, setTimeout(fn) { fn(); }, requestAnimationFrame(fn) { fn(); } };
  const observers=[];
  window.IntersectionObserver=class { constructor(callback) { this.callback=callback; this.targets=[]; observers.push(this); } observe(target) { this.targets.push(target); } unobserve() {} disconnect() { this.targets=[]; } };
  const context = vm.createContext({ window, document, URL, URLSearchParams, Date, Set, WeakSet, WeakMap, clFindProduct: options.findProduct || (() => null),
    performance: { now: () => 1000, getEntriesByType: () => [] },
    CustomEvent: class { constructor(type) { this.type = type; } }, setTimeout: window.setTimeout, setInterval: window.setInterval });
  vm.runInContext(source,context);
  const emit = (type,event = {}) => { for(const fn of listeners[type] || []) fn(event); };
  const choose = (text) => { const b = nodes.get("cl-consent-banner"); b.children[2].children.find(el => el.textContent === text).click(); };
  const events = () => (window.dataLayer || []).filter(call => call[0] === "event");
  return { window, document, events, emit, choose, observers };
}

test("no carga analítica sin consentimiento y la aceptación tardía envía una sola visita", () => {
  const b = browser();
  assert.equal(b.document.head.children.length,0);
  assert.equal(b.window.clAnalytics.track("add_to_cart",{ value: 20 }),false);
  b.choose("Aceptar analítica");
  assert.equal(b.events().filter(e=>e[1]==="page_view").length,1);
  assert.equal(b.events().filter(e=>e[1]==="add_to_cart").length,0);
});

test("todos los eventos llevan contexto limpio y la atribución conserva solo campañas válidas", () => {
  const b = browser("granted");
  b.window.clAnalytics.track("filter_select",{ filter_id:"sueno", email:"private", secret:"hidden", link_url:"https://wa.me/?text=private" });
  const e=b.events().find(e=>e[1]==="filter_select")[2];
  assert.equal(e.page_path,"/tienda");
  assert.equal(e.page_type,"catalog");
  assert.equal(e.email,undefined);
  assert.equal(e.secret,undefined);
  assert.equal(e.link_url,undefined);
  const config=b.window.dataLayer.find(e=>e[0]==="config")[2];
  assert.equal(config.page_location,origin+"/tienda");
  assert.equal(config.page_referrer,"https://example.com/");
  assert.equal(config.campaign_source,"instagram");
  assert.equal(config.campaign_name,"noviembre");
});

test("revocar y volver a aceptar actualiza el proveedor y detiene eventos", () => {
  const b=browser("granted");
  b.window.clAnalytics.openPreferences(); b.choose("Rechazar");
  const length=b.events().length;
  assert.equal(b.window.clAnalytics.track("faq_open",{}),false);
  assert.equal(b.window["ga-disable-G-9QHN0YJKJW"],true);
  b.window.clAnalytics.openPreferences(); b.choose("Aceptar analítica");
  assert.equal(b.window["ga-disable-G-9QHN0YJKJW"],false);
  assert.equal(b.window.clAnalytics.track("faq_open",{}),true);
  assert.ok(b.events().length>length);
  assert.equal(b.document.head.children.length,1);
});

test("scroll registra umbrales una vez y nunca antes del consentimiento", () => {
  const b=browser("granted");
  b.window.scrollY=1000; b.emit("scroll"); b.emit("scroll");
  const events=b.events().filter(e=>e[1]==="scroll_depth");
  assert.deepEqual(Array.from(events,e=>e[2].percent_scrolled),[25,50,75]);
});

test("WhatsApp mide el pedido abierto y el bloqueo con estados distintos", () => {
  const main=readFileSync(new URL("../js/main.js",import.meta.url),"utf8");
  const start=main.indexOf("function checkoutWhatsApp()");
  const func=main.slice(start,main.indexOf("\n}\n",start)+3);
  for (const blocked of [false,true]) {
    const events=[]; const popup={ opener: {}, location: { replace(url) { this.url=url; } }, close() {} };
    const window={ open:()=>blocked?null:popup, clAnalytics:{ track:(name,p)=>events.push([name,p]) } };
    vm.runInNewContext(func,{ window, cartLoad:()=>[{id:"hair",qty:1}], clWhatsAppUrl:()=>"https://wa.me/123?text=order",
      whatsappOrderMessage:()=>"order", toast:()=>{}, cartTotal:()=>23.99, analyticsCartItems:()=>[] });
    vm.runInNewContext(func+"; checkoutWhatsApp();",{ window, cartLoad:()=>[{id:"hair",qty:1}], clWhatsAppUrl:()=>"https://wa.me/123?text=order",
      whatsappOrderMessage:()=>"order", toast:()=>{}, cartTotal:()=>23.99, analyticsCartItems:()=>[] });
    assert.equal(events.some(e=>e[0]==="generate_lead"),!blocked);
    assert.equal(events.some(e=>e[0]==="checkout_error"),blocked);
    if (!blocked) { assert.equal(popup.opener,null); assert.match(popup.location.url,/wa.me/); }
  }
});

test('no envía términos de búsqueda ni campañas con datos de contacto', () => {
  // La URL de pruebas se sustituye antes de volver a iniciar en otra VM.
  const altered=source.replace('var query = new URLSearchParams(window.location.search);', 'var query = new URLSearchParams("utm_source=instagram&utm_term=Juan%20Perez%200987654321&utm_content=0987654321&utm_campaign=juan%40example.com");');
  const c=browser();
  const context=vm.createContext({ window:c.window, document:c.document, URL, URLSearchParams, Date, Set, WeakSet, WeakMap, CustomEvent:class{constructor(type){this.type=type;}} });
  c.window.localStorage.setItem('cl_analytics_consent_v1','granted'); vm.runInContext(altered,context);
  const config=c.window.dataLayer.find(e=>e[0]==='config')[2];
  assert.equal(config.campaign_term,undefined); assert.equal(config.campaign_content,undefined); assert.equal(config.campaign_name,undefined);
});

test('al reaceptar vuelve a observar las exposiciones actuales sin duplicar las anteriores', () => {
  const card={ id:'', getAttribute:()=> 'hair-nails-forte', closest:()=>null, parentElement:null, matches:()=>false };
  const b=browser('granted','/tienda',{targets:selector=>selector.includes('[data-products-grid]')?[card]:[],findProduct:()=>({id:'hair-nails-forte',name:'Hair',price:23.99})});
  b.window.clAnalytics.openPreferences(); b.choose('Rechazar');
  b.observers[0].callback([{target:card,isIntersecting:true,intersectionRatio:.9}]);
  assert.equal(b.events().filter(e=>e[1]==='view_item_list').length,0);
  b.window.clAnalytics.openPreferences(); b.choose('Aceptar analítica');
  assert.ok(b.observers.at(-1).targets.includes(card),'se debe volver a observar la tarjeta tras reaceptar');
  assert.ok(b.observers.length>1 || b.observers[0].targets.length>1,'necesita una nueva observación para disparar la exposición vigente');
});

test('las fichas se registran también al aceptar después de cargar', () => {
  const product={id:'hair-nails-forte',name:'Hair',price:23.99};
  const b=browser('','/hair-nails-forte',{findProduct:()=>product});
  b.document.body.setAttribute('data-product-id',product.id);
  b.choose('Aceptar analítica');
  assert.equal(b.events().filter(e=>e[1]==='view_item').length,1);
  b.document.dispatchEvent({type:'cl:catalogrender'});
  assert.equal(b.events().filter(e=>e[1]==='view_item').length,1);
  b.emit('pageshow',{persisted:true});
  assert.equal(b.events().filter(e=>e[1]==='view_item').length,2);
});

test('las exposiciones de historia solo cuentan la escena activa visible', () => {
  let active=false;
  const card={id:'', getAttribute:()=> 'hair-nails-forte',closest:()=>null,parentElement:null,
    matches:selector=>selector.includes('fs-scene'),classList:{contains:()=>active},getBoundingClientRect:()=>({top:0,bottom:500})};
  const b=browser('granted','/',{targets:selector=>selector.includes('fs-scene')?[card]:[],findProduct:()=>({id:'hair-nails-forte',name:'Hair',price:23.99})});
  b.document.dispatchEvent({type:'cl:storyview'});
  assert.equal(b.events().filter(e=>e[1]==='view_item_list').length,0);
  active=true; b.document.dispatchEvent({type:'cl:storyview'}); b.document.dispatchEvent({type:'cl:storyview'});
  const events=b.events().filter(e=>e[1]==='view_item_list');
  assert.equal(events.length,1); assert.equal(events[0][2].item_list_id,'home_story');
});

test('los importes de artículo y carrito mantienen el descuento efectivo por cantidad', () => {
  const main=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
  const start=main.indexOf('function analyticsCartItems(');
  const source=main.slice(start,main.indexOf('\n}\n',start)+3);
  const result=vm.runInNewContext(source+'; analyticsCartItems([{id:"hair",variant:"uno",qty:2}]);',{
    clFindProduct:()=>({name:'Hair',goalLabel:'Cabello'}),itemPrice:()=>29.99,itemTotal:()=>49.99
  });
  assert.equal(result[0].price*result[0].quantity,49.99);
});

test('cambios y retiradas del carrito conservan value igual a la suma de artículos', () => {
  const main=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
  const funcs=['analyticsCartItems','cartSetQty','cartRemove'].map(name=>{const start=main.indexOf('function '+name+'(');return main.slice(start,main.indexOf('\n}\n',start)+3);}).join('\n');
  let cart=[{id:'hair',variant:'uno',qty:2}]; const events=[];
  const context=vm.createContext({clFindProduct:()=>({name:'Hair',goalLabel:'Cabello'}),itemPrice:()=>29.99,itemTotal:it=>it.qty===2?49.99:29.99*it.qty,
    cartLoad:()=>cart,cartSave:items=>{cart=items;},renderCart:()=>{},window:{clAnalytics:{track:(name,params)=>events.push({name,...params})}}});
  vm.runInContext(funcs+'; cartSetQty("hair","uno",4);',context);
  let e=events.find(e=>e.name==='add_to_cart');
  assert.equal(e.value,e.items.reduce((sum,i)=>sum+i.price*i.quantity,0));
  cart=[{id:'hair',variant:'uno',qty:2}]; events.length=0;
  vm.runInContext('cartRemove("hair","uno");',context);
  e=events[0]; assert.equal(e.value,49.99); assert.equal(e.value,e.items.reduce((sum,i)=>sum+i.price*i.quantity,0));
});
