import { test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { projectRoot } from '../scripts/lib/catalog.mjs';

const setup = `
import importlib.util, datetime as dt, json, math
from unittest.mock import patch
from zoneinfo import ZoneInfo
spec = importlib.util.spec_from_file_location('report', 'scripts/analytics_report.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
w = m.date_windows(dt.date(2026,11,9))
`;
function check(code) { execFileSync('python3',['-B','-c',setup+code],{cwd:projectRoot,stdio:'pipe'}); }

test('GA4 pagina filas, conserva filtros y declara truncamiento y umbrales', () => check(`
calls=[]
def api(url, data=None, **kwargs):
 p=json.loads(data); calls.append(p)
 return {'dimensionHeaders':[{'name':'eventName'}], 'rows':[{'dimensionValues':[{'value':'view_item'}], 'metricValues':[{'value':'2'}]}], 'rowCount':3, 'metadata':{'subjectToThresholding':True, 'dataLossFromOtherRow':True}}
notes=[]
with patch.object(m,'http_json_retrying',api):
 rows=m.run_report('x','123',w['current_start'],w['current_end'],['eventName'],['eventCount'],limit=2,dimension_filter={'filter':{'fieldName':'eventName','stringFilter':{'value':'view_item'}}},diagnostics=notes)
assert len(rows)==2, rows
assert calls[1]['offset']=='1', calls
assert calls[1]['dimensionFilter']==calls[0]['dimensionFilter']
assert any('trunc' in n.lower() for n in notes), notes
assert any('umbral' in n.lower() for n in notes), notes
assert any('(other)' in n for n in notes), notes
`));

test('el informe distingue acciones y usuarios, no inventa conversiones ni tasas con cero', () => check(`
d=m.sample_data()
d['events_week']=[{'eventName':'generate_lead','eventCount':30,'totalUsers':12},{'eventName':'begin_checkout','eventCount':30,'totalUsers':12}]
d['weekly']['totalUsers']=100
h=m.report_html(d,w,dt.datetime(2026,11,9,tzinfo=ZoneInfo('America/Guayaquil')))
for title in ['Fuentes y campañas','Páginas de entrada','Intención comercial','Calidad de los datos','Horarios','12.0%']:
 assert title in h, title
assert 'intención, no ventas confirmadas' in h
assert m.ratio(10,0) is None
assert m.fmt_rate(None)=='—'
assert not __import__('re').search(r'(?i)\\bnan\\b', m.report_html({},w,dt.datetime.now()))
assert m.number(float('nan'))==0
`));

test('CSV completos se adjuntan en un ZIP y neutralizan fórmulas y HTML', () => check(`
d=m.sample_data(); d['sources']=[{'sessionSourceMedium':'=HYPERLINK("bad")','sessions':10}]
d['pages']=[{'pagePath':'<script>alert(1)</script>','screenPageViews':5}]
exports=m.report_exports(d,w)
assert 'detalle-fuentes.csv' in exports, exports.keys()
assert "'=HYPERLINK" in exports['detalle-fuentes.csv']
h=m.report_html(d,w,dt.datetime.now())
assert '<script>alert' not in h and '&lt;script&gt;' in h
captured=[]
class SMTP:
 def __init__(self,*a,**k): pass
 def __enter__(self): return self
 def __exit__(self,*a): return False
 def login(self,*a): pass
 def send_message(self,msg): captured.append(msg)
config={'smtp_host':'x','smtp_port':465,'smtp_user':'x','smtp_password':'x','sender':'from@example.com','recipient':m.DEFAULT_TO}
with patch.object(m.smtplib,'SMTP_SSL',SMTP):
 m.send_email('Informe',h,m.report_text(d,w),config,attachments=exports)
parts=list(captured[0].iter_attachments())
assert len(parts)==1
assert parts[0].get_content_type()=='application/zip'
import io,zipfile
with zipfile.ZipFile(io.BytesIO(parts[0].get_payload(decode=True))) as archive:
 assert set(archive.namelist())==set(exports)
 assert archive.read('detalle-fuentes.csv').decode('utf-8-sig').startswith('sessionSourceMedium')
assert 'Fuentes' in m.report_text(d,w)
`));

test('consultas incluyen semanas comparables y dimensiones opcionales solo cuando existen', () => check(`
calls=[]
def report(*args,**kwargs):
 calls.append((args,kwargs)); return []
with patch.object(m,'run_report',report), patch.object(m,'property_metadata',lambda *a: {'dimensions':[], 'metrics':[]}):
 data=m.fetch_data('x','123',w)
for key in ['sources','campaigns','landing_pages','cities','technology','hours','events_by_page','events_previous','diagnostics']:
 assert key in data,key
assert any('registr' in n.lower() for n in data['diagnostics'])
assert not any(any(str(v).startswith('customEvent:') for v in a[4]) for a,k in calls)
`));

test('cada consulta de resumen respeta el máximo de diez métricas de GA4', () => check(`
def api(url,data=None,**kwargs):
 p=json.loads(data)
 assert len(p['metrics'])<=10, p['metrics']
 return {'rowCount':0}
with patch.object(m,'http_json_retrying',api):
 m.summary('x','123',w['current_start'],w['current_end'])
`));

test('un informe denso mantiene el HTML por debajo del presupuesto de correo', () => check(`
d=m.sample_data()
for key,dim in [('sources','sessionSourceMedium'),('campaigns','sessionCampaignName'),('landing_pages','landingPage'),('cities','city'),('technology','browser')]:
 d[key]=[{dim:'Valor largo '+str(i),'sessions':100,'engagementRate':.6,'totalUsers':60} for i in range(15)]
d['events_four']=[{'eventName':name,'eventCount':100,'totalUsers':60} for name in m.EVENT_LABELS]
for key,param in [('scroll','percent_scrolled'),('sections','section_id'),('faq','faq_id'),('filters','filter_id'),('contact_contexts','link_context'),('errors','error_type')]:
 d[key]=[{'eventName':'custom_event','customEvent:'+param:'some_detail_'+str(i),'eventCount':30,'totalUsers':20} for i in range(8)]
h=m.report_html(d,w,dt.datetime.now())
assert len(h.encode('utf-8'))<90000, len(h.encode('utf-8'))
assert 'Calidad de los datos' in h and 'Para profundizar' in h
`));

test('rendimiento consulta solo la media registrada y conserva su unidad en milisegundos', () => check(`
calls=[]
metadata={'dimensions':[{'apiName':'customEvent:metric_name'}], 'metrics':[{'apiName':'averageCustomEvent:metric_value'}]}
with patch.object(m,'run_report',lambda *a,**k: calls.append((a,k)) or []), patch.object(m,'property_metadata',lambda *a:metadata):
 d=m.fetch_data('x','123',w)
assert 'performance' in d
args,kwargs=next((a,k) for a,k in calls if 'averageCustomEvent:metric_value' in a[5])
assert kwargs['dimension_filter']['filter']['stringFilter']['value']=='performance_timing'
d['performance']=[{'customEvent:metric_name':'ttfb','averageCustomEvent:metric_value':123,'eventCount':10}]
h=m.report_html(d,w,dt.datetime.now())
assert '123 ms' in h and 'Rendimiento' in h
`));
