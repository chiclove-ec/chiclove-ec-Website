#!/usr/bin/env python3
"""Informe semanal de GA4 para Chic&Love.

Solo usa la biblioteca estándar de Python: consulta la GA4 Data API con una
cuenta de servicio y envía un correo HTML por SMTP. No guarda datos personales
ni escribe informes dentro del repositorio.
"""

from __future__ import annotations

import argparse
import base64
import csv
import io
import datetime as dt
import html
import json
import math
import os
import re
import smtplib
import ssl
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from email.message import EmailMessage
from email.utils import parseaddr
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional
from zoneinfo import ZoneInfo


API_SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
TOKEN_URL = "https://oauth2.googleapis.com/token"
API_URL = "https://analyticsdata.googleapis.com/v1beta/properties/{property_id}:runReport"
DEFAULT_TO = "marketing@laboratorioslira.com"
DEFAULT_TIMEZONE = "America/Guayaquil"
MONTHS = ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")
REQUIRED_ENV = ("GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_JSON", "REPORT_SMTP_USER", "REPORT_SMTP_PASSWORD")
RETRY_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = 5
# 408, 429 y la familia 5xx son congestión o mantenimiento del proveedor y pasan
# solos; un 401 o un 403 son credencial inválida y reintentarlos solo retrasa el
# aviso. El informe es semanal: si se pierde, no hay segunda oportunidad.
RETRYABLE_STATUS = frozenset({408, 429, 500, 502, 503, 504})
# Techo global de espera por reintentos. Un job cancelado por `timeout-minutes`
# NO dispara el `if: failure()` que abre el aviso, así que los reintentos se
# rinden antes de llegar ahí: más vale fallar a tiempo y en voz alta.
RETRY_BUDGET_SECONDS = 180


def b64url(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


class TransientError(RuntimeError):
    """Fallo de red o de servicio ajeno que merece otro intento."""


class RetryBudget:
    """Tiempo total que todo el informe puede gastar reintentando.

    Es compartido: trece consultas a GA4 con tres intentos cada una sumarían
    mucho más que el `timeout-minutes` del job si cada una contase aparte.
    """

    def __init__(self, seconds: float = RETRY_BUDGET_SECONDS) -> None:
        self.remaining = float(seconds)

    def spend(self, seconds: float) -> bool:
        if seconds > self.remaining:
            return False
        self.remaining -= seconds
        return True


RETRY_BUDGET = RetryBudget()


def with_retries(operation: Callable[[], Any], description: str, *,
                 attempts: int = RETRY_ATTEMPTS, backoff: int = RETRY_BACKOFF_SECONDS,
                 budget: Optional[RetryBudget] = None) -> Any:
    """Repite `operation` mientras el fallo sea transitorio y quede presupuesto."""
    budget = RETRY_BUDGET if budget is None else budget
    last: Optional[TransientError] = None
    for attempt in range(1, attempts + 1):
        started = time.monotonic()
        try:
            return operation()
        except TransientError as error:
            last = error
            if attempt == attempts:
                break
            pause = backoff * attempt
            # Se cobra también lo que tardó el intento fallido: un timeout de 45 s
            # consume presupuesto aunque no haya habido espera entre intentos.
            if not budget.spend(time.monotonic() - started + pause):
                print(f"{description}: sin presupuesto para más reintentos", flush=True)
                break
            print(f"{description}: intento {attempt} de {attempts} falló ({error}); reintento en {pause} s", flush=True)
            time.sleep(pause)
    raise RuntimeError(f"{description} falló tras {attempts} intentos: {last}")


def http_json(url: str, data: Optional[bytes] = None, headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    request = urllib.request.Request(url, data=data, headers=headers or {}, method="POST" if data else "GET")
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        message = f"Respuesta HTTP {error.code} de {url}: {detail[:800]}"
        raise (TransientError if error.code in RETRYABLE_STATUS else RuntimeError)(message) from error
    except urllib.error.URLError as error:
        raise TransientError(f"No se pudo conectar con {url}: {error.reason}") from error


def http_json_retrying(url: str, data: Optional[bytes] = None, headers: Optional[Dict[str, str]] = None,
                       *, description: str) -> Dict[str, Any]:
    return with_retries(lambda: http_json(url, data=data, headers=headers), description)


def _valid_email(value: str) -> bool:
    name, address = parseaddr(value)
    return not name and address == value and bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", value))


def validate_config(environ: Mapping[str, str]) -> Dict[str, Any]:
    """Valida y normaliza la configuración sin llamar a servicios externos."""
    errors: List[str] = []
    missing = [name for name in REQUIRED_ENV if not str(environ.get(name, "")).strip()]
    if missing:
        errors.append("Faltan secretos o variables requeridas: " + ", ".join(missing))

    property_id = str(environ.get("GA4_PROPERTY_ID", "")).strip()
    if property_id and not re.fullmatch(r"\d+", property_id):
        errors.append("GA4_PROPERTY_ID debe ser un ID numérico de propiedad GA4")

    credentials: Optional[Dict[str, Any]] = None
    credentials_raw = str(environ.get("GA4_SERVICE_ACCOUNT_JSON", "")).strip()
    if credentials_raw:
        try:
            parsed = json.loads(credentials_raw)
        except json.JSONDecodeError:
            errors.append("GA4_SERVICE_ACCOUNT_JSON no contiene JSON válido")
        else:
            if not isinstance(parsed, dict):
                errors.append("GA4_SERVICE_ACCOUNT_JSON debe ser un objeto JSON")
            else:
                credentials = parsed
                if not str(parsed.get("client_email", "")).strip():
                    errors.append("GA4_SERVICE_ACCOUNT_JSON no contiene client_email")
                private_key = str(parsed.get("private_key", "")).strip()
                if not private_key:
                    errors.append("GA4_SERVICE_ACCOUNT_JSON no contiene private_key")
                elif not re.search(r"-----BEGIN (?:RSA )?PRIVATE KEY-----", private_key):
                    errors.append("GA4_SERVICE_ACCOUNT_JSON contiene una private_key que no parece PEM")

    username = str(environ.get("REPORT_SMTP_USER", "")).strip()
    if username and not _valid_email(username):
        errors.append("REPORT_SMTP_USER debe ser una dirección de correo válida")

    # Gmail muestra las contraseñas de aplicación agrupadas; al copiarlas
    # pueden llegar con espacios normales o no separables. SMTP no los admite.
    smtp_password = "".join(str(environ.get("REPORT_SMTP_PASSWORD", "")).split())
    smtp_host = str(environ.get("REPORT_SMTP_HOST", "")).strip() or "smtp.gmail.com"
    smtp_port_raw = str(environ.get("REPORT_SMTP_PORT", "")).strip() or "465"
    try:
        smtp_port = int(smtp_port_raw)
        if not 1 <= smtp_port <= 65535:
            raise ValueError
    except ValueError:
        errors.append("REPORT_SMTP_PORT debe ser un puerto entre 1 y 65535")
        smtp_port = 465

    sender = str(environ.get("REPORT_FROM_EMAIL", "")).strip() or username
    if sender and not _valid_email(sender):
        errors.append("REPORT_FROM_EMAIL debe ser una dirección de correo válida")

    recipient = str(environ.get("REPORT_TO_EMAIL", "")).strip() or DEFAULT_TO
    if recipient != DEFAULT_TO:
        errors.append(f"REPORT_TO_EMAIL debe ser {DEFAULT_TO}")

    timezone_name = str(environ.get("REPORT_TIMEZONE", "")).strip() or DEFAULT_TIMEZONE
    try:
        ZoneInfo(timezone_name)
    except Exception:
        errors.append("REPORT_TIMEZONE no es una zona horaria IANA válida")

    if errors:
        raise RuntimeError("Configuración inválida del informe semanal:\n- " + "\n- ".join(errors))

    return {
        "property_id": property_id,
        "credentials": credentials,
        "smtp_host": smtp_host,
        "smtp_port": smtp_port,
        "smtp_user": username,
        "smtp_password": smtp_password,
        "sender": sender,
        "recipient": recipient,
        "timezone": timezone_name,
    }


def access_token(credentials: Dict[str, Any]) -> str:
    now = int(time.time())
    header = b64url(json.dumps({"alg": "RS256", "typ": "JWT"}, separators=(",", ":")).encode())
    claims = {
        "iss": credentials["client_email"],
        "scope": API_SCOPE,
        "aud": TOKEN_URL,
        "iat": now,
        "exp": now + 3600,
    }
    body = b64url(json.dumps(claims, separators=(",", ":")).encode())
    signing_input = f"{header}.{body}".encode("ascii")

    with tempfile.TemporaryDirectory(prefix="cl-ga4-") as folder:
        root = Path(folder)
        key_path = root / "private-key.pem"
        input_path = root / "jwt-input"
        signature_path = root / "jwt-signature"
        key_path.write_text(credentials["private_key"].replace("\\n", "\n"), encoding="utf-8")
        os.chmod(key_path, 0o600)
        input_path.write_bytes(signing_input)
        try:
            subprocess.run(
                ["openssl", "dgst", "-sha256", "-sign", str(key_path), "-out", str(signature_path), str(input_path)],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
        except FileNotFoundError as error:
            raise RuntimeError("OpenSSL no está disponible para autenticar GA4") from error
        except subprocess.CalledProcessError as error:
            raise RuntimeError("OpenSSL no pudo firmar la autenticación de GA4") from error
        assertion = f"{signing_input.decode('ascii')}.{b64url(signature_path.read_bytes())}"

    token_response = http_json_retrying(
        TOKEN_URL,
        data=urllib.parse.urlencode({
            "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
            "assertion": assertion,
        }).encode("ascii"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        description="La autenticación con GA4",
    )
    token = token_response.get("access_token")
    if not token:
        raise RuntimeError("Google no devolvió un token de acceso para GA4")
    return token


def number(value: Any) -> float:
    try:
        result = float(value or 0)
        return result if math.isfinite(result) else 0.0
    except (TypeError, ValueError):
        return 0.0


def run_report(token: str, property_id: str, start: dt.date, end: dt.date,
               dimensions: Iterable[str], metrics: Iterable[str], limit: int = 100,
               order_metric: Optional[str] = None, *, dimension_filter: Optional[Dict[str, Any]] = None,
               diagnostics: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Consulta paginada con límite total explícito y advertencias de calidad."""
    dimension_names, metric_names = list(dimensions), list(metrics)
    rows: List[Dict[str, Any]] = []
    label = ", ".join(dimension_names) or "resumen"
    while len(rows) < limit:
        payload: Dict[str, Any] = {
            "dateRanges": [{"startDate": start.isoformat(), "endDate": end.isoformat()}],
            "dimensions": [{"name": name} for name in dimension_names],
            "metrics": [{"name": name} for name in metric_names],
            "limit": str(min(1000, limit - len(rows))), "offset": str(len(rows)),
            "keepEmptyRows": False,
        }
        if order_metric:
            payload["orderBys"] = [{"metric": {"metricName": order_metric}, "desc": True}]
        if dimension_filter:
            payload["dimensionFilter"] = dimension_filter
        response = http_json_retrying(
            API_URL.format(property_id=urllib.parse.quote(property_id, safe="")),
            data=json.dumps(payload).encode("utf-8"),
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            description=f"La consulta a GA4 ({label})",
        )
        metadata = response.get("metadata", {})
        if diagnostics is not None:
            flags = [
                (metadata.get("subjectToThresholding"), "sujeto a umbrales de privacidad; pueden faltar filas"),
                (metadata.get("dataLossFromOtherRow"), "incluye agrupación (other) por alta cardinalidad"),
                (metadata.get("samplingMetadatas"), "usa muestreo de GA4"),
            ]
            for active, note in flags:
                value = f"{label}: {note}"
                if active and value not in diagnostics:
                    diagnostics.append(value)
            if metadata.get("timeZone") and metadata["timeZone"] != DEFAULT_TIMEZONE:
                note = f"GA4 agrupa fechas y horas en {metadata['timeZone']}; el envío usa {DEFAULT_TIMEZONE}."
                if note not in diagnostics:
                    diagnostics.append(note)
        batch = response.get("rows", [])
        for row in batch:
            values = [item.get("value", "") for item in row.get("dimensionValues", [])]
            metric_values = [number(item.get("value")) for item in row.get("metricValues", [])]
            rows.append({**dict(zip(dimension_names, values)), **dict(zip(metric_names, metric_values))})
        total = int(response.get("rowCount", len(rows)))
        if not batch or len(rows) >= total:
            break
    if diagnostics is not None and total > len(rows):
        diagnostics.append(f"{label}: detalle truncado a {len(rows)} de {total} filas; los totales generales se consultan por separado.")
    return rows[:limit]


def property_metadata(token: str, property_id: str) -> Dict[str, Any]:
    return http_json_retrying(
        API_URL.format(property_id=urllib.parse.quote(property_id, safe="")).replace(":runReport", "/metadata"),
        headers={"Authorization": f"Bearer {token}"}, description="El esquema de GA4",
    )


def summary(token: str, property_id: str, start: dt.date, end: dt.date, diagnostics: Optional[List[str]] = None) -> Dict[str, float]:
    metrics = [
        "activeUsers", "totalUsers", "newUsers", "sessions", "engagedSessions",
        "screenPageViews", "eventCount", "userEngagementDuration", "engagementRate", "bounceRate",
    ]
    rows = run_report(token, property_id, start, end, [], metrics, limit=1, diagnostics=diagnostics)
    return {metric: (rows[0].get(metric, 0.0) if rows else 0.0) for metric in metrics}


def date_windows(today: dt.date) -> Dict[str, dt.date]:
    monday = today - dt.timedelta(days=today.weekday())
    current_start = monday - dt.timedelta(days=7)
    current_end = current_start + dt.timedelta(days=6)
    previous_start = current_start - dt.timedelta(days=7)
    previous_end = current_start - dt.timedelta(days=1)
    four_start = current_start - dt.timedelta(days=21)
    return {
        "current_start": current_start,
        "current_end": current_end,
        "previous_start": previous_start,
        "previous_end": previous_end,
        "four_start": four_start,
        "four_end": current_end,
    }


def fetch_data(token: str, property_id: str, windows: Dict[str, dt.date]) -> Dict[str, Any]:
    start, end = windows["current_start"], windows["current_end"]
    four_start, four_end = windows["four_start"], windows["four_end"]
    notes: List[str] = []
    event_metrics = ["eventCount", "totalUsers"]
    traffic_metrics = ["sessions", "totalUsers", "engagedSessions", "engagementRate", "userEngagementDuration"]
    data: Dict[str, Any] = {"diagnostics": notes, "property_id": property_id}
    for key, first, last in [("weekly", start, end), ("previous", windows["previous_start"], windows["previous_end"]), ("four_weeks", four_start, four_end)]:
        data[key] = summary(token, property_id, first, last, notes)
    for key, first, last in [("events_week", start, end), ("events_previous", windows["previous_start"], windows["previous_end"]), ("events_four", four_start, four_end)]:
        data[key] = run_report(token, property_id, first, last, ["eventName"], event_metrics, 1000, "eventCount", diagnostics=notes)
    reports = {
        "daily": (["date"], ["sessions", "activeUsers", "screenPageViews", "engagedSessions"], "sessions"),
        "pages": (["pagePath"], ["screenPageViews", "totalUsers", "userEngagementDuration"], "screenPageViews"),
        "channels": (["sessionDefaultChannelGroup"], traffic_metrics, "sessions"),
        "sources": (["sessionSourceMedium"], traffic_metrics, "sessions"),
        "campaigns": (["sessionCampaignName", "sessionSourceMedium"], traffic_metrics, "sessions"),
        "landing_pages": (["landingPage"], traffic_metrics, "sessions"),
        "devices": (["deviceCategory"], traffic_metrics, "sessions"),
        "countries": (["country"], ["totalUsers", "sessions"], "sessions"),
        "cities": (["country", "region", "city"], ["totalUsers", "sessions"], "sessions"),
        "technology": (["deviceCategory", "browser", "operatingSystem"], ["sessions", "engagementRate"], "sessions"),
        "hours": (["dayOfWeek", "hour"], ["sessions", "totalUsers"], "sessions"),
        "visitor_types": (["newVsReturning"], ["totalUsers", "sessions", "engagementRate"], "sessions"),
        "products": (["itemName", "itemId"], ["itemsViewedInList", "itemsClickedInList", "itemsViewed", "itemsAddedToCart", "itemsCheckedOut"], "itemsViewed"),
        "variants": (["itemName", "itemVariant"], ["itemsAddedToCart", "itemsCheckedOut"], "itemsAddedToCart"),
        "events_by_page": (["eventName", "pagePath"], event_metrics, "eventCount"),
    }
    for key, (dimensions, metrics, order) in reports.items():
        data[key] = run_report(token, property_id, four_start, four_end, dimensions, metrics, 5000, order, diagnostics=notes)
    data["daily"].sort(key=lambda row: str(row.get("date", "")))
    data["lead_sources"] = run_report(token, property_id, four_start, four_end, ["sessionSourceMedium"], event_metrics, 5000, "eventCount",
        dimension_filter={"filter": {"fieldName": "eventName", "stringFilter": {"value": "generate_lead", "matchType": "EXACT"}}}, diagnostics=notes)
    metadata = property_metadata(token, property_id)
    available = {entry["apiName"] for entry in metadata.get("dimensions", [])}
    optional = {
        "scroll": "percent_scrolled", "sections": "section_id", "faq": "faq_id", "filters": "filter_id",
        "contact_contexts": "link_context", "active_time": "active_seconds", "errors": "error_type", "controls": "element_id",
    }
    missing = []
    for key, param in optional.items():
        dimension = "customEvent:" + param
        if dimension not in available:
            missing.append(param)
            continue
        data[key] = run_report(token, property_id, four_start, four_end, ["eventName", dimension], event_metrics, 5000, "eventCount", diagnostics=notes)
    if missing:
        notes.append("Desglose pendiente de registrar dimensiones personalizadas en GA4: " + ", ".join(missing) + ". Los eventos sí se recogen; el desglose comienza cuando se registra cada dimensión.")
    metric_names = {entry["apiName"] for entry in metadata.get("metrics", [])}
    if "customEvent:metric_name" in available and "averageCustomEvent:metric_value" in metric_names:
        data["performance"] = run_report(token, property_id, four_start, four_end, ["customEvent:metric_name"], ["averageCustomEvent:metric_value", "eventCount"], 100, "eventCount",
            dimension_filter={"filter": {"fieldName": "eventName", "stringFilter": {"value": "performance_timing", "matchType": "EXACT"}}}, diagnostics=notes)
    else:
        notes.append("Rendimiento pendiente de dimensión metric_name y métrica metric_value registradas en GA4 (media en milisegundos).")
    return data


def period_label(start: dt.date, end: dt.date) -> str:
    if start.year == end.year and start.month == end.month:
        return f"{start.day}–{end.day} {MONTHS[end.month - 1]} {end.year}"
    return f"{start.day} {MONTHS[start.month - 1]} – {end.day} {MONTHS[end.month - 1]} {end.year}"


def fmt(value: Any) -> str:
    return f"{number(value):,.0f}".replace(",", ".")


def fmt_duration(seconds: Any) -> str:
    total = max(0, int(number(seconds)))
    minutes, secs = divmod(total, 60)
    return f"{minutes} min {secs:02d} s" if minutes else f"{secs} s"


def fmt_pct(value: Any) -> str:
    return f"{number(value) * 100:.1f}%"


def change(current: Any, previous: Any) -> str:
    current_value, previous_value = number(current), number(previous)
    if previous_value == 0:
        return "Nuevo" if current_value else "—"
    percentage = (current_value - previous_value) / previous_value * 100
    return f"{'↑' if percentage >= 0 else '↓'} {abs(percentage):.1f}%"


def esc(value: Any) -> str:
    return html.escape(str(value if value not in (None, "") else "—"), quote=True)


def event_map(rows: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {str(row.get("eventName") or "(sin nombre)"): row for row in rows}


EVENT_LABELS = {
    "page_view": "Páginas vistas", "view_item_list": "Exposiciones de producto", "select_item": "Clics en producto",
    "view_item": "Fichas consultadas", "add_to_cart": "Adiciones al carrito", "remove_from_cart": "Retiradas del carrito",
    "view_cart": "Aperturas del carrito", "begin_checkout": "Pedidos enviados a WhatsApp", "generate_lead": "Intenciones de pedido",
    "whatsapp_click": "Clics de contacto WhatsApp", "instagram_click": "Clics a Instagram", "filter_select": "Filtros utilizados",
    "faq_open": "Preguntas abiertas", "open_menu": "Aperturas del menú", "navigation_click": "Enlaces de navegación",
    "button_click": "Controles pulsados", "section_view": "Secciones vistas", "scroll_depth": "Profundidad de lectura",
    "engagement_milestone": "Hitos de tiempo activo", "quantity_change": "Cambios de cantidad", "variant_select": "Variantes elegidas",
    "checkout_error": "Problemas al abrir WhatsApp", "technical_error": "Fallos técnicos", "performance_timing": "Tiempos de carga",
}
EXPORT_LABELS = {
    "weekly": "resumen-semana", "previous": "resumen-anterior", "four_weeks": "resumen-28-dias",
    "daily": "tendencia-diaria", "events_week": "eventos-semana", "events_previous": "eventos-anterior", "events_four": "eventos-28-dias",
    "pages": "paginas", "channels": "canales", "sources": "fuentes", "campaigns": "campanas", "landing_pages": "entradas",
    "devices": "dispositivos", "countries": "paises", "cities": "ciudades", "technology": "tecnologia", "hours": "horarios",
    "visitor_types": "visitantes", "products": "productos", "variants": "variantes", "events_by_page": "eventos-por-pagina",
    "lead_sources": "intencion-por-fuente", "scroll": "lectura", "sections": "secciones", "faq": "preguntas", "filters": "filtros",
    "contact_contexts": "contacto", "active_time": "tiempo-activo", "errors": "errores", "controls": "controles", "performance": "rendimiento",
}


def ratio(numerator: Any, denominator: Any) -> Optional[float]:
    return number(numerator) / number(denominator) if number(denominator) > 0 else None


def fmt_rate(value: Optional[float]) -> str:
    return "—" if value is None else fmt_pct(value)


def event_value(data: Dict[str, Any], period: str, name: str, metric: str = "eventCount") -> float:
    return number(event_map(data.get(period, [])).get(name, {}).get(metric))


def csv_cell(value: Any) -> Any:
    # Impide que una etiqueta externa se ejecute como fórmula al abrirla en Excel.
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def report_exports(data: Dict[str, Any], windows: Dict[str, dt.date]) -> Dict[str, str]:
    exports: Dict[str, str] = {}
    for key, label in EXPORT_LABELS.items():
        value = data.get(key)
        rows = [value] if isinstance(value, dict) else value
        if not rows:
            continue
        fields = list(dict.fromkeys(field for row in rows for field in row))
        buffer = io.StringIO(newline="")
        writer = csv.writer(buffer)
        writer.writerow(fields)
        for row in rows:
            writer.writerow([csv_cell(row.get(field, "")) for field in fields])
        exports[f"detalle-{label}.csv"] = buffer.getvalue()
    exports["LEEME.txt"] = "\n".join([
        "Chic&Love Ecuador — datos agregados de GA4",
        f"Semana: {windows['current_start']} a {windows['current_end']}",
        f"Anterior: {windows['previous_start']} a {windows['previous_end']}",
        f"Detalle y resto de CSV: {windows['four_start']} a {windows['four_end']} (28 días)",
        "Los CSV resumen-*, eventos-semana y eventos-anterior conservan su periodo indicado.",
        "La zona horaria de las consultas es la de la propiedad GA4; el envío usa America/Guayaquil.",
        "Son datos de visitantes que consienten y cuya medición no está bloqueada.",
        "eventCount cuenta acciones; totalUsers cuenta usuarios por fila, no sumables entre filas.",
        "Las acciones no son un embudo secuencial. generate_lead y begin_checkout describen la misma apertura; no se suman.",
        "WhatsApp mide intención, no ventas confirmadas. El valor del carrito no son ingresos.",
        "items* mide unidades de cada variante, no personas ni siempre frascos individuales.",
        "Una celda vacía o — indica que no hay base para calcular; no equivale a un cero medido.",
        "Los CSV incluyen todas las filas recuperadas, con límite de 5.000 por desglose; ver advertencias.",
        "Las etiquetas externas se anteponen con apóstrofo si podrían ejecutarse como fórmulas.",
        *data.get("diagnostics", []),
    ])
    return exports


def email_table(headers: List[str], rows: List[List[Any]], empty: str = "Sin datos en este periodo") -> str:
    if not rows:
        return f'<p style="color:#77717f;font-size:13px">{esc(empty)}</p>'
    head = "".join(f'<th scope="col" style="padding:10px 7px;text-align:{"left" if i == 0 else "right"};font-size:10px;color:#746a80;border-bottom:1px solid #ded7e5">{esc(cell)}</th>' for i, cell in enumerate(headers))
    body = "".join('<tr>' + "".join(f'<td style="padding:8px 5px;text-align:{"left" if i == 0 else "right"};border-bottom:1px solid #eee;word-break:break-word">{esc(str(cell)[:120] + ("…" if len(str(cell)) > 120 else ""))}</td>' for i, cell in enumerate(row)) + '</tr>' for row in rows)
    return f'<table width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:12px;line-height:1.5"><thead><tr>{head}</tr></thead><tbody>{body}</tbody></table>'


def email_section(title: str, subtitle: str, content: str) -> str:
    return f'<tr><td class="pad" style="padding:24px 32px 8px;border-top:1px solid #eee9f0"><h2 style="margin:0 0 5px;font-size:20px;line-height:1.25;color:#34283f">{esc(title)}</h2><p style="margin:0 0 16px;font-size:12px;color:#7b7283">{esc(subtitle)}</p>{content}</td></tr>'


def email_daily_bars(rows: List[Dict[str, Any]]) -> str:
    maximum = max([1.0] + [number(row.get("sessions")) for row in rows])
    bars = []
    for row in rows:
        value = max(0.0, number(row.get("sessions")))
        width = min(100, max(1, round(value / maximum * 100))) if value else 0
        fill = f'<td width="{width}%" height="8" bgcolor="#8b6aa9" style="font-size:0;line-height:0">&nbsp;</td>' if width else ""
        rest = f'<td width="{100 - width}%" height="8" bgcolor="#eee8f3" style="font-size:0;line-height:0">&nbsp;</td>' if width < 100 else ""
        label = esc(row.get("label"))
        bars.append(f'<tr><td width="68" style="padding:5px 0;font-size:11px;color:#766a80">{label}</td><td style="padding:5px 8px"><div role="img" aria-label="{label}: {fmt(value)} sesiones"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>{fill}{rest}</tr></table></div></td><td width="40" align="right" style="font-size:11px;color:#51415e">{fmt(value)}</td></tr>')
    return '<p style="margin:0 0 6px;font-size:12px;color:#766a80">Sesiones por día</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px">' + ''.join(bars) + '</table>'


def report_insights(data: Dict[str, Any]) -> List[str]:
    weekly, previous = data.get("weekly", {}), data.get("previous", {})
    sessions = number(weekly.get("sessions"))
    users = number(weekly.get("totalUsers"))
    leads = event_value(data, "events_week", "generate_lead", "totalUsers")
    insights = [f"{fmt(sessions)} sesiones esta semana · {change(sessions, previous.get('sessions'))} frente a la anterior.",
                f"{fmt(leads)} usuarios con intención de pedido · {fmt_rate(ratio(leads, users))} de los usuarios totales medidos."]
    if sessions < 30:
        insights.append("Volumen semanal reducido: usa la ventana de 28 días para orientar decisiones y evita atribuir los cambios a una causa sin más evidencia.")
    errors = event_value(data, "events_week", "checkout_error")
    if errors:
        insights.append(f"Revisar WhatsApp: {fmt(errors)} intentos encontraron un bloqueo o fallo de apertura.")
    if data.get("sources"):
        top = max(data["sources"], key=lambda row: number(row.get("sessions")))
        insights.append(f"Mayor fuente de los últimos 28 días: {top.get('sessionSourceMedium', '—')} · {fmt(top.get('sessions'))} sesiones.")
    return insights


def report_html(data: Dict[str, Any], windows: Dict[str, dt.date], generated_at: dt.datetime) -> str:
    weekly, previous = data.get("weekly", {}), data.get("previous", {})
    week_label = period_label(windows["current_start"], windows["current_end"])
    four_label = period_label(windows["four_start"], windows["four_end"])
    events = event_map(data.get("events_week", []))
    prev_events = event_map(data.get("events_previous", []))
    four_events = event_map(data.get("events_four", []))
    users, sessions = number(weekly.get("totalUsers")), number(weekly.get("sessions"))
    lead_users = event_value(data, "events_week", "generate_lead", "totalUsers")
    previous_leads = event_value(data, "events_previous", "generate_lead", "totalUsers")
    kpis = [
        ("Usuarios activos", fmt(weekly.get("activeUsers")), change(weekly.get("activeUsers"), previous.get("activeUsers"))),
        ("Sesiones", fmt(sessions), change(sessions, previous.get("sessions"))),
        ("Vistas", fmt(weekly.get("screenPageViews")), change(weekly.get("screenPageViews"), previous.get("screenPageViews"))),
        ("Usuarios con intención", fmt(lead_users), change(lead_users, previous_leads)),
        ("Interacción", fmt_rate(number(weekly["engagementRate"])) if "engagementRate" in weekly else "—", change(weekly.get("engagementRate"), previous.get("engagementRate"))),
        ("Tiempo activo / sesión", fmt_duration(number(weekly.get("userEngagementDuration")) / sessions) if sessions else "—", "tiempo total / sesiones"),
    ]
    cards = []
    for offset in (0, 3):
        cells = ''.join(f'<td class="kpi" width="33.3%" style="padding:14px 10px;background:#f6f2fa;border:4px solid #fff;vertical-align:top"><p style="margin:0;font-size:10px;color:#7b6c88;text-transform:uppercase">{esc(title)}</p><p style="margin:7px 0;font-size:25px;line-height:1.15;font-weight:bold;color:#392744">{esc(value)}</p><p style="margin:0;font-size:11px;color:#71647b">{esc(delta)}</p></td>' for title, value, delta in kpis[offset:offset+3])
        cards.append(f'<tr>{cells}</tr>')
    insights = ''.join(f'<li style="margin:0 0 8px">{esc(item)}</li>' for item in report_insights(data))
    body = email_section("Lectura de la semana", "Variaciones de los indicadores frente a la semana anterior; señales para orientar la revisión.",
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0">{"".join(cards)}</table><ul style="padding-left:20px;font-size:13px;line-height:1.65">{insights}</ul>')
    action_names = ["view_item", "add_to_cart", "view_cart", "begin_checkout", "generate_lead", "whatsapp_click", "checkout_error"]
    action_rows = [[EVENT_LABELS[name], fmt(events.get(name, {}).get("eventCount")), fmt(events.get(name, {}).get("totalUsers")), change(events.get(name, {}).get("eventCount"), prev_events.get(name, {}).get("eventCount")), fmt(four_events.get(name, {}).get("eventCount"))] for name in action_names]
    rate_rows = [["Intención de pedido / usuarios totales", fmt_rate(ratio(lead_users, users))],
        ["Usuarios que añadieron / usuarios totales", fmt_rate(ratio(event_value(data, "events_week", "add_to_cart", "totalUsers"), users))],
        ["Usuarios con clic de contacto / usuarios totales", fmt_rate(ratio(event_value(data, "events_week", "whatsapp_click", "totalUsers"), users))],
        ["Vistas por sesión", f"{number(weekly.get('screenPageViews')) / sessions:.2f}" if sessions else "—"],
        ["Usuarios nuevos", fmt(weekly.get("newUsers"))], ["Sesiones con interacción", fmt(weekly.get("engagedSessions"))],
        ["Rebote", fmt_pct(weekly["bounceRate"]) if "bounceRate" in weekly else "—"]]
    body += email_section("Intención comercial", "Semana: acciones y usuarios únicos por acción. Última columna: acciones de 28 días.",
        email_table(["Acción", "Veces", "Usuarios", "Cambio", "28 d"], action_rows) +
        '<p style="font-size:12px;color:#746780;line-height:1.6">WhatsApp mide intención, no ventas confirmadas. Inicio de pedido e intención describen la misma apertura y no se suman. Las filas no forman un embudo secuencial; una persona puede participar en varias.</p>' + email_table(["Indicador semanal", "Valor"], rate_rows))
    daily = {str(row.get("date")): row for row in data.get("daily", [])}
    daily_rows = []
    chart_rows = []
    for offset in range(7):
        day = windows["current_start"] + dt.timedelta(days=offset)
        row = daily.get(day.strftime("%Y%m%d"), {})
        daily_rows.append([f"{day.day} {MONTHS[day.month-1]}", fmt(row.get("sessions")), fmt(row.get("activeUsers")), fmt(row.get("screenPageViews"))])
        chart_rows.append({"label": f"{day.day} {MONTHS[day.month-1]}", "sessions": number(row.get("sessions"))})
    body += email_section("Tendencia diaria", "Semana cerrada. El CSV conserva cada fecha recuperada de los últimos 28 días.", email_daily_bars(chart_rows) + email_table(["Día", "Sesiones", "Activos", "Vistas"], daily_rows))
    def traffic(key: str, labels: List[str], dimensions: List[str], maximum: int = 6) -> str:
        rows = [[" · ".join(str(row.get(dim) or "(sin asignar)") for dim in dimensions), fmt(row.get("sessions")), fmt_pct(row["engagementRate"]) if "engagementRate" in row else "—"] for row in data.get(key, [])[:maximum]]
        return email_table(labels + ["Sesiones", "Interacción"], rows)
    body += email_section("Fuentes y campañas", f"Últimos 28 días · {four_label}. Principales filas; detalle completo recuperado en CSV.",
        '<h3 style="font-size:14px">Canales</h3>' + traffic("channels", ["Canal"], ["sessionDefaultChannelGroup"]) +
        '<h3 style="font-size:14px">Fuentes / medios</h3>' + traffic("sources", ["Fuente / medio"], ["sessionSourceMedium"]) +
        '<h3 style="font-size:14px">Campañas</h3>' + traffic("campaigns", ["Campaña · fuente"], ["sessionCampaignName", "sessionSourceMedium"], 6))
    lead_sources = [[r.get("sessionSourceMedium"), fmt(r.get("eventCount")), fmt(r.get("totalUsers"))] for r in data.get("lead_sources", [])[:6]]
    if lead_sources:
        body += email_section("Qué fuentes originan intención", "28 días · usuarios y acciones del evento generate_lead, con atribución de sesión.", email_table(["Fuente / medio", "Acciones", "Usuarios"], lead_sources))
    body += email_section("Páginas de entrada", "28 días · dónde comienza la sesión y qué proporción tiene interacción.", traffic("landing_pages", ["Entrada"], ["landingPage"]))
    pages = [[r.get("pagePath"), fmt(r.get("screenPageViews")), fmt(r.get("totalUsers", r.get("activeUsers"))), fmt_duration(number(r.get("userEngagementDuration")) / number(r.get("totalUsers"))) if number(r.get("totalUsers")) else "—"] for r in data.get("pages", [])[:7]]
    body += email_section("Contenido consultado", "28 días · tiempo activo por usuario de cada página; usuarios no sumables entre filas.", email_table(["Página", "Vistas", "Usuarios", "Tiempo / usuario"], pages))
    products = [[r.get("itemName") or r.get("itemId"), fmt(r.get("itemsViewedInList")), fmt(r.get("itemsViewed")), fmt(r.get("itemsAddedToCart")), fmt(r.get("itemsCheckedOut"))] for r in data.get("products", [])[:7]]
    body += email_section("Rendimiento de productos", "28 días · unidades de las variantes registradas. Exposición real de lista, fichas, adiciones y envío a WhatsApp; el CSV añade clics y variantes.",
        email_table(["Producto", "Lista", "Ficha", "Añadidas", "WhatsApp"], products))
    body += email_section("Audiencia y tecnología", "28 días · principales segmentos. La ubicación es aproximada y depende de lo que GA4 pueda informar.",
        '<h3 style="font-size:14px">Dispositivos</h3>' + traffic("devices", ["Dispositivo"], ["deviceCategory"]) +
        '<h3 style="font-size:14px">Navegadores y sistemas</h3>' + traffic("technology", ["Entorno"], ["deviceCategory", "browser", "operatingSystem"], 5) +
        '<h3 style="font-size:14px">Países</h3>' + email_table(["País", "Usuarios", "Sesiones"], [[r.get("country"), fmt(r.get("totalUsers", r.get("activeUsers"))), fmt(r.get("sessions"))] for r in data.get("countries", [])[:6]]))
    if data.get("cities"):
        body += email_section("Ciudades y regiones", "28 días · principales ubicaciones agregadas; el CSV conserva el resto.", email_table(["Ubicación", "Usuarios", "Sesiones"], [[" · ".join(str(r.get(k) or "—") for k in ("city", "region", "country")), fmt(r.get("totalUsers")), fmt(r.get("sessions"))] for r in data["cities"][:6]]))
    weekdays = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    hours = [[f"{weekdays[int(r['dayOfWeek'])]} {str(r.get('hour','0')).zfill(2)}:00", fmt(r.get("sessions")), fmt(r.get("totalUsers"))] for r in data.get("hours", [])[:8] if str(r.get("dayOfWeek", "")) in "0123456" and str(r.get("dayOfWeek", ""))]
    body += email_section("Horarios", "28 días · franjas con más sesiones, según la zona horaria de la propiedad GA4.", email_table(["Día y hora", "Sesiones", "Usuarios"], hours))
    names = list(dict.fromkeys(list(EVENT_LABELS) + list(events) + list(four_events)))
    event_rows = [[EVENT_LABELS.get(name, name), fmt(events.get(name, {}).get("eventCount")), fmt(events.get(name, {}).get("totalUsers")), fmt(four_events.get(name, {}).get("eventCount"))] for name in names if name in events or name in four_events][:30]
    body += email_section("Detalle de interacciones", "Cada evento incluye contexto de página. Los CSV permiten cruzar las acciones con páginas y dimensiones registradas.", email_table(["Interacción", "Semana", "Usuarios", "28 d"], event_rows))
    for key, title, param in [("scroll", "Profundidad de lectura", "percent_scrolled"), ("sections", "Secciones vistas", "section_id"), ("faq", "Preguntas consultadas", "faq_id"), ("filters", "Filtros", "filter_id"), ("contact_contexts", "Ubicación del contacto", "link_context"), ("errors", "Fallos de interacción", "error_type")]:
        rows = [[r.get("eventName"), r.get("customEvent:" + param), fmt(r.get("eventCount")), fmt(r.get("totalUsers"))] for r in data.get(key, []) if r.get("customEvent:" + param) not in (None, "", "(not set)")][:4]
        if rows:
            body += email_section(title, "28 días · dimensión personalizada registrada en GA4.", email_table(["Evento", "Detalle", "Veces", "Usuarios"], rows))
    performance_rows = [[r.get("customEvent:metric_name"), f"{fmt(r.get('averageCustomEvent:metric_value'))} ms", fmt(r.get("eventCount"))] for r in data.get("performance", [])]
    if performance_rows:
        body += email_section("Rendimiento", "28 días · medias de tiempos de navegación en milisegundos; no son percentiles ni Core Web Vitals.", email_table(["Métrica", "Media", "Muestras"], performance_rows))
    notes = ["Cobertura: solo visitantes que aceptan analítica y cuya medición llega a GA4. Bloqueadores, consentimiento y procesamiento pueden reducir los datos.",
        "Los usuarios únicos por página, evento o segmento se solapan: no sumes las filas. Nuevos y recurrentes tampoco son grupos necesariamente excluyentes en 28 días.",
        "Los eventos nuevos y sus parámetros empiezan a producir datos tras publicar. Las dimensiones personalizadas necesitan registro en la propiedad y no rellenan el histórico.",
        "El correo muestra las filas principales. Los CSV incluyen el detalle recuperado (hasta 5.000 filas por desglose); umbrales, muestreo y truncamientos se indican aquí.",
        "No se envían datos de contacto, conversaciones, IP ni pedidos individuales; los CSV contienen estadísticas agregadas de catálogo e interacción.", *data.get("diagnostics", [])]
    body += email_section("Calidad de los datos", "Cómo interpretar el informe y sus límites.", '<ul style="padding-left:18px;font-size:12px;line-height:1.65;color:#766a80">' + ''.join(f'<li style="margin-bottom:8px">{esc(n)}</li>' for n in notes) + '</ul>')
    body += email_section("Para profundizar", "CSV dentro del ZIP adjunto: resumen, adquisición, contenido, catálogo, audiencia e interacciones.", '<p style="font-size:12px;line-height:1.65;color:#766a80">Abre el ZIP y consulta LEEME.txt para consultar periodos, unidades y advertencias. El cuerpo del correo prioriza la lectura rápida; los adjuntos conservan el detalle.</p>')
    if re.fullmatch(r"\d+", str(data.get("property_id", ""))):
        body += f'<tr><td class="pad" style="padding:22px 32px"><a href="https://analytics.google.com/analytics/web/#/p{esc(data["property_id"])}/reports/intelligenthome" style="display:inline-block;padding:12px 20px;background:#735098;border-radius:24px;color:#fff;text-decoration:none;font-size:13px">Abrir Google Analytics</a></td></tr>'
    # Retira secciones completas, reservando siempre metodología y adjuntos.
    sections = re.split(r'(?=<tr><td class="pad" style="padding:24px)', body)
    for title in ["Preguntas consultadas", "Secciones vistas", "Profundidad de lectura", "Filtros", "Ubicación del contacto", "Fallos de interacción", "Detalle de interacciones", "Ciudades y regiones", "Horarios", "Audiencia y tecnología", "Contenido consultado", "Páginas de entrada"]:
        if len("".join(sections).encode("utf-8")) < 78000:
            break
        sections = [section for section in sections if f">{esc(title)}</h2>" not in section]
    body = "".join(sections)
    return f'''<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Informe Chic&amp;Love · {esc(week_label)}</title><style>@media(max-width:600px){{.pad{{padding-left:16px!important;padding-right:16px!important}}.kpi p{{font-size:11px!important}}.kpi p:nth-child(2){{font-size:21px!important}}}}</style></head><body style="margin:0;padding:0;background:#f4f1f5;color:#322b38;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden">{fmt(sessions)} sesiones · {fmt(lead_users)} usuarios con intención de pedido · {esc(week_label)}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1f5"><tr><td align="center" style="padding:24px 0"><table role="presentation" width="760" cellpadding="0" cellspacing="0" style="width:100%;max-width:760px;background:#fff;border-radius:18px;overflow:hidden"><tr><td class="pad" style="padding:36px 32px;background:#362542;color:#fff"><p style="margin:0 0 16px;font-size:10px;letter-spacing:2px;color:#d7c6e9">CHIC&amp;LOVE ECUADOR · MARKETING</p><h1 style="margin:0 0 12px;font-size:32px;line-height:1.15">Tu semana en datos</h1><p style="margin:0;font-size:14px;color:#e5d9ed">{esc(week_label)}</p><p style="margin:8px 0 0;font-size:12px;color:#ccbbd7">Comparación semanal y perspectiva de 28 días</p></td></tr>{body}<tr><td class="pad" style="padding:24px 32px;background:#f7f4f9;color:#7a6d83;font-size:11px;line-height:1.7">Generado el {esc(generated_at.strftime('%d/%m/%Y a las %H:%M'))} ({esc(str(generated_at.tzinfo))}).<br>Chic&amp;Love Ecuador · marketing@laboratorioslira.com</td></tr></table></td></tr></table></body></html>'''


def report_text(data: Dict[str, Any], windows: Dict[str, dt.date]) -> str:
    lines = ["Chic&Love Ecuador — Tu semana en datos", f"Semana: {period_label(windows['current_start'], windows['current_end'])}",
             f"Detalle de 28 días: {period_label(windows['four_start'], windows['four_end'])}", "", *report_insights(data), "",
             "Intención, no ventas confirmadas. begin_checkout y generate_lead describen la misma apertura de WhatsApp; no se suman.", ""]
    for key, label in EXPORT_LABELS.items():
        rows = data.get(key)
        if not rows:
            continue
        lines.append(label.replace("-", " ").capitalize() + ":")
        for row in ([rows] if isinstance(rows, dict) else rows)[:8]:
            lines.append(" · ".join(f"{field}: {value}" for field, value in row.items()))
        lines.append("")
    lines.extend(["Fuentes, campañas, productos, audiencia e interacciones: detalle completo recuperado en los CSV adjuntos.",
                  "Solo datos agregados de quienes aceptan analítica; los usuarios de distintas filas pueden solaparse.", *data.get("diagnostics", [])])
    return "\n".join(lines)



def send_email(subject: str, html_body: str, text_body: str, config: Dict[str, Any], *,
               attachments: Optional[Dict[str, str]] = None) -> None:
    host = config["smtp_host"]
    port = config["smtp_port"]
    username = config["smtp_user"]
    password = config["smtp_password"]
    sender = config["sender"]
    recipient = config["recipient"]
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = recipient
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")
    if attachments:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            for filename, content in attachments.items():
                archive.writestr(filename, content.encode("utf-8-sig" if filename.endswith(".csv") else "utf-8"))
        message.add_attachment(buffer.getvalue(), maintype="application", subtype="zip", filename="chiclove-analitica.zip")

    def deliver() -> None:
        try:
            if port == 465:
                with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context(), timeout=45) as server:
                    server.login(username, password)
                    server.send_message(message)
            else:
                with smtplib.SMTP(host, port, timeout=45) as server:
                    server.ehlo()
                    server.starttls(context=ssl.create_default_context())
                    server.ehlo()
                    server.login(username, password)
                    server.send_message(message)
        except smtplib.SMTPAuthenticationError as error:
            # El texto del servidor basta para diagnosticar; la contraseña no se imprime.
            raise RuntimeError(f"El servidor SMTP rechazó las credenciales (código {error.smtp_code})") from error
        except (smtplib.SMTPRecipientsRefused, smtplib.SMTPSenderRefused) as error:
            raise RuntimeError(f"El servidor SMTP rechazó la dirección del correo: {error}") from error
        except (smtplib.SMTPException, OSError) as error:
            raise TransientError(f"Fallo temporal del servidor SMTP: {error}") from error

    with_retries(deliver, "El envío del informe")


def sample_data() -> Dict[str, Any]:
    return {
        "weekly": {"activeUsers": 124, "sessions": 168, "screenPageViews": 403, "eventCount": 912, "engagedSessions": 118, "newUsers": 105, "userEngagementDuration": 7320, "engagementRate": .70, "bounceRate": .30},
        "previous": {"activeUsers": 100, "sessions": 150, "screenPageViews": 360, "eventCount": 800},
        "four_weeks": {},
        "daily": [{"date": "20260901", "sessions": 12, "activeUsers": 9, "screenPageViews": 27}, {"date": "20260902", "sessions": 15, "activeUsers": 11, "screenPageViews": 39}],
        "events_week": [{"eventName": "whatsapp_click", "eventCount": 24}, {"eventName": "view_item", "eventCount": 58}],
        "events_four": [{"eventName": "whatsapp_click", "eventCount": 89}, {"eventName": "view_item", "eventCount": 210}],
        "pages": [{"pagePath": "/index.html", "screenPageViews": 220, "activeUsers": 100}],
        "channels": [{"sessionDefaultChannelGroup": "Direct", "sessions": 70, "activeUsers": 55, "screenPageViews": 160}],
        "devices": [{"deviceCategory": "mobile", "activeUsers": 80, "sessions": 110, "screenPageViews": 250}],
        "countries": [{"country": "Ecuador", "activeUsers": 100, "sessions": 140}],
        "products": [{"itemName": "Hair & Nails Forte", "itemsViewed": 60, "itemsAddedToCart": 10, "itemsCheckedOut": 4}],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Envía el informe semanal de GA4 de Chic&Love")
    parser.add_argument("--fixture", help="JSON local para previsualizar sin llamar a GA4")
    parser.add_argument("--output", help="Guarda el HTML en esta ruta en vez de enviarlo")
    parser.add_argument("--export-dir", help="Guarda los CSV agregados y LEEME.txt en esta carpeta")
    parser.add_argument("--no-send", action="store_true", help="No envía correo; útil para comprobar el diseño")
    parser.add_argument("--check-config", action="store_true", help="Valida secretos y configuración sin llamar a GA4 ni enviar correo")
    args = parser.parse_args()
    preview_only = bool(args.fixture and (args.output or args.no_send))
    try:
        config = None if preview_only and not args.check_config else validate_config(os.environ)
    except RuntimeError as error:
        raise SystemExit(str(error)) from None
    if args.check_config:
        print(f"Configuración válida; el informe se enviará a {config['recipient']}")
        return

    timezone = ZoneInfo(config["timezone"]) if config else ZoneInfo(DEFAULT_TIMEZONE)
    now = dt.datetime.now(timezone)
    windows = date_windows(now.date())

    if args.fixture:
        data = json.loads(Path(args.fixture).read_text(encoding="utf-8"))
    else:
        assert config is not None
        data = fetch_data(access_token(config["credentials"]), config["property_id"], windows)

    html_body = report_html(data, windows, now)
    if args.export_dir:
        folder = Path(args.export_dir)
        folder.mkdir(parents=True, exist_ok=True)
        for filename, content in report_exports(data, windows).items():
            (folder / filename).write_text(content, encoding="utf-8-sig" if filename.endswith(".csv") else "utf-8")
    if args.output:
        Path(args.output).write_text(html_body, encoding="utf-8")
        print(f"Informe generado: {args.output}")
        return
    if args.no_send:
        print("Informe validado sin envío")
        return
    assert config is not None
    subject = f"Chic&Love   Analítica semanal   {period_label(windows['current_start'], windows['current_end'])}"
    send_email(subject, html_body, report_text(data, windows), config, attachments=report_exports(data, windows))
    print(f"Informe enviado a {config['recipient']}")


if __name__ == "__main__":
    main()
