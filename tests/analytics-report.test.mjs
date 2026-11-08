import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { test } from "node:test";

import { projectRoot } from "../scripts/lib/catalog.mjs";

test("el informe semanal genera HTML determinista sin credenciales", () => {
  const check = `
import datetime as dt
import importlib.util
from zoneinfo import ZoneInfo
spec = importlib.util.spec_from_file_location("report", "scripts/analytics_report.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
windows = module.date_windows(dt.date(2026, 9, 7))
html = module.report_html(module.sample_data(), windows, dt.datetime(2026, 9, 7, 14, tzinfo=ZoneInfo("America/Guayaquil")))
assert 'role="presentation"' in html
assert "<svg" not in html  # Correo compatible también con clientes sin SVG.
assert "marketing@laboratorioslira.com" in html
assert "Hair &amp; Nails Forte" in html
assert windows["current_start"].isoformat() == "2026-08-31"
`;
  execFileSync("python3", ["-B", "-c", check], { cwd: projectRoot, stdio: "pipe" });
});

test("la configuración incompleta enumera cada secreto requerido sin exponer valores", () => {
  const check = `
import importlib.util
spec = importlib.util.spec_from_file_location("report", "scripts/analytics_report.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
try:
    module.validate_config({})
except RuntimeError as error:
    message = str(error)
    for name in ("GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_JSON", "REPORT_SMTP_USER", "REPORT_SMTP_PASSWORD"):
        assert name in message, message
    assert "marketing@laboratorioslira.com" not in message
else:
    raise AssertionError("La configuración vacía debe rechazarse")
`;
  execFileSync("python3", ["-B", "-c", check], { cwd: projectRoot, stdio: "pipe" });
});

test("el preflight de CLI informa el error sin una traza técnica", () => {
  const env = { ...process.env };
  for (const name of ["GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_JSON", "REPORT_SMTP_USER", "REPORT_SMTP_PASSWORD"]) {
    delete env[name];
  }
  assert.throws(
    () => execFileSync("python3", ["scripts/analytics_report.py", "--check-config"], { cwd: projectRoot, env, stdio: "pipe" }),
    (error) => {
      const stderr = error.stderr.toString();
      assert.match(stderr, /Configuración inválida del informe semanal/);
      assert.doesNotMatch(stderr, /Traceback/);
      return true;
    },
  );
});

test("la configuración válida se normaliza y conserva el destinatario de Lira", () => {
  const check = `
import importlib.util
spec = importlib.util.spec_from_file_location("report", "scripts/analytics_report.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
config = module.validate_config({
    "GA4_PROPERTY_ID": "123456789",
    "GA4_SERVICE_ACCOUNT_JSON": '{"type":"service_account","client_email":"reporter@example.com","private_key":"-----BEGIN PRIVATE KEY-----\\\\nfake\\\\n-----END PRIVATE KEY-----"}',
    "REPORT_SMTP_USER": "reporter@example.com",
    "REPORT_SMTP_PASSWORD": "app-password",
    "REPORT_TO_EMAIL": "marketing@laboratorioslira.com",
    "REPORT_TIMEZONE": "America/Guayaquil",
})
assert config["property_id"] == "123456789"
assert config["smtp_host"] == "smtp.gmail.com"
assert config["smtp_port"] == 465
assert config["recipient"] == "marketing@laboratorioslira.com"
try:
    module.validate_config({
        "GA4_PROPERTY_ID": "123456789",
        "GA4_SERVICE_ACCOUNT_JSON": '{"client_email":"reporter@example.com","private_key":"-----BEGIN PRIVATE KEY-----\\\\nfake\\\\n-----END PRIVATE KEY-----"}',
        "REPORT_SMTP_USER": "reporter@example.com",
        "REPORT_SMTP_PASSWORD": "app-password",
        "REPORT_TO_EMAIL": "otro@example.com",
    })
except RuntimeError as error:
    assert "REPORT_TO_EMAIL" in str(error)
else:
    raise AssertionError("El destinatario del reporte no debe poder cambiarse")
try:
    module.validate_config({
        "GA4_PROPERTY_ID": "123456789",
        "GA4_SERVICE_ACCOUNT_JSON": '{"type":"service_account","client_email":"reporter@example.com","private_key":"fake-key"}',
        "REPORT_SMTP_USER": "reporter@example.com",
        "REPORT_SMTP_PASSWORD": "app-password",
    })
except RuntimeError as error:
    assert "private_key" in str(error)
else:
    raise AssertionError("Una clave privada que no es PEM debe rechazarse")
`;
  execFileSync("python3", ["-B", "-c", check], { cwd: projectRoot, stdio: "pipe" });
});

test("la previsualización con fixture sigue funcionando sin credenciales", () => {
  const folder = mkdtempSync(`${tmpdir()}/cl-analytics-`);
  const fixture = `${folder}/fixture.json`;
  const output = `${folder}/report.html`;
  writeFileSync(fixture, "{}", "utf8");
  const env = { ...process.env };
  for (const name of ["GA4_PROPERTY_ID", "GA4_SERVICE_ACCOUNT_JSON", "REPORT_SMTP_USER", "REPORT_SMTP_PASSWORD"]) {
    delete env[name];
  }
  try {
    execFileSync("python3", ["scripts/analytics_report.py", "--fixture", fixture, "--output", output], {
      cwd: projectRoot,
      env,
      stdio: "pipe",
    });
    assert.match(readFileSync(output, "utf8"), /Tu semana en datos/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("la contraseña SMTP tolera espacios invisibles o separadores de copia", () => {
  const check = `
import importlib.util
spec = importlib.util.spec_from_file_location("report", "scripts/analytics_report.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
config = module.validate_config({
    "GA4_PROPERTY_ID": "123456789",
    "GA4_SERVICE_ACCOUNT_JSON": '{"client_email":"reporter@example.com","private_key":"-----BEGIN PRIVATE KEY-----\\\\nfake\\\\n-----END PRIVATE KEY-----"}',
    "REPORT_SMTP_USER": "reporter@example.com",
    "REPORT_SMTP_PASSWORD": "\\u00a0app- password\\u00a0",
})
assert config["smtp_password"] == "app-password"
`;
  execFileSync("python3", ["-B", "-c", check], { cwd: projectRoot, stdio: "pipe" });
});

test("el envío SMTP construye un correo HTML dirigido a Lira", () => {
  const check = `
import importlib.util
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("report", "scripts/analytics_report.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class FakeSMTP:
    instance = None
    def __init__(self, *args, **kwargs):
        FakeSMTP.instance = self
        self.args = args
        self.kwargs = kwargs
        self.message = None
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def login(self, username, password):
        assert username == "reporter@example.com"
        assert password == "app-password"
    def send_message(self, message):
        self.message = message
config = {
    "smtp_host": "smtp.gmail.com",
    "smtp_port": 465,
    "smtp_user": "reporter@example.com",
    "smtp_password": "app-password",
    "sender": "reporter@example.com",
    "recipient": "marketing@laboratorioslira.com",
}
with patch.object(module.smtplib, "SMTP_SSL", FakeSMTP):
    module.send_email("Asunto", "<p>Informe</p>", "Informe", config)
assert FakeSMTP.instance.args == ("smtp.gmail.com", 465)
assert FakeSMTP.instance.message["To"] == "marketing@laboratorioslira.com"
assert FakeSMTP.instance.message.get_body(preferencelist=("html",)).get_content().strip() == "<p>Informe</p>"
`;
  execFileSync("python3", ["-B", "-c", check], { cwd: projectRoot, stdio: "pipe" });
});

const workflow = readFileSync(`${projectRoot}/.github/workflows/weekly-analytics-report.yml`, "utf8");

test("el workflow queda programado los lunes y usa el destinatario correcto", () => {
  assert.match(workflow, /REPORT_TO_EMAIL: marketing@laboratorioslira\.com/);
  assert.match(workflow, /GA4_SERVICE_ACCOUNT_JSON/);
  assert.match(workflow, /REPORT_SMTP_PASSWORD/);
  const preflight = workflow.indexOf("python3 scripts/analytics_report.py --check-config");
  const report = workflow.indexOf("python3 scripts/analytics_report.py\n");
  assert.ok(preflight >= 0, "El workflow debe validar la configuración antes del envío");
  assert.ok(report > preflight, "El envío debe ocurrir después de la validación");
});

// GitHub concentra en el minuto 0 la mayor carga de cron del día: retrasa esas
// ejecuciones y puede descartarlas. Los dos únicos runs programados con "0 14"
// salieron 4 h 27 min y 4 h 55 min tarde, y el tercero no llegó a dispararse.
test("el cron del informe evita el minuto de máxima congestión de GitHub", () => {
  const crons = [...workflow.matchAll(/cron:\s*["']([^"']+)["']/g)].map(([, value]) => value);
  assert.equal(crons.length, 1, "el informe debe tener exactamente una programación");
  const [minute, hour, , , weekday] = crons[0].trim().split(/\s+/);
  assert.equal(weekday, "1", "el informe se envía los lunes");
  assert.equal(hour, "14", "14:00 UTC es la mañana en Ecuador");
  assert.notEqual(minute, "0", "el minuto 0 es el slot que GitHub retrasa o descarta");
  assert.match(minute, /^\d{1,2}$/);
  assert.ok(Number(minute) >= 1 && Number(minute) <= 59, "el minuto debe ser válido");
});

// El informe falló el 7 y el 14 de septiembre de 2026 sin que nadie se enterara:
// un workflow programado solo avisa por correo al dueño del repositorio.
test("un fallo del informe deja rastro visible en el repositorio", () => {
  assert.match(workflow, /issues: write/, "sin permiso no puede abrir el aviso");
  assert.match(workflow, /if:\s*failure\(\)/, "falta el paso que escala el fallo");
  assert.match(workflow, /gh issue (create|comment)/, "el aviso debe quedar como issue");
  assert.match(workflow, /GH_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/);
});

// Regla del repositorio: interpolar `${{ }}` dentro de un `run:` es la vía por la
// que entran las inyecciones en Actions. Los valores se pasan por `env:`.
test("el workflow no interpola expresiones dentro de un run", () => {
  for (const [, script] of workflow.matchAll(/run:\s*\|?\n((?:[ \t]+.*\n?)+)/g)) {
    assert.doesNotMatch(script, /\$\{\{/, `un run: interpola una expresión:\n${script}`);
  }
});

// Un informe semanal no tiene segunda oportunidad: si GA4 o el SMTP fallan por
// un hipo de red, la semana se pierde hasta el lunes siguiente.
test("los fallos transitorios de GA4 se reintentan y los definitivos no", () => {
  const check = `
import io
import importlib.util
import urllib.error
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("report", "scripts/analytics_report.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def http_error(status):
    return urllib.error.HTTPError("https://ga4.example", status, "nope", {}, io.BytesIO(b"detalle"))

class Response:
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def read(self): return b'{"ok": true}'

calls = []
def flaky(request, timeout=None):
    calls.append(1)
    if len(calls) < 3:
        raise urllib.error.URLError("conexión caída")
    return Response()

with patch.object(module.time, "sleep", lambda *_: None):
    with patch.object(module.urllib.request, "urlopen", flaky):
        assert module.http_json_retrying("https://ga4.example", description="La consulta") == {"ok": True}
    assert len(calls) == 3, calls

    for status in (500, 503, 429):
        intentos = []
        def congestion(request, timeout=None, status=status):
            intentos.append(1)
            raise http_error(status)
        with patch.object(module.urllib.request, "urlopen", congestion):
            try:
                module.http_json_retrying("https://ga4.example", description="La consulta")
            except RuntimeError as error:
                assert "intentos" in str(error), error
            else:
                raise AssertionError("un fallo persistente debe acabar fallando")
        assert len(intentos) > 1, f"{status} debe reintentarse"

    for status in (401, 403, 404):
        intentos = []
        def denegado(request, timeout=None, status=status):
            intentos.append(1)
            raise http_error(status)
        with patch.object(module.urllib.request, "urlopen", denegado):
            try:
                module.http_json_retrying("https://ga4.example", description="La consulta")
            except RuntimeError:
                pass
            else:
                raise AssertionError("una credencial inválida debe fallar")
        assert len(intentos) == 1, f"{status} no debe reintentarse: {intentos}"
`;
  execFileSync("python3", ["-B", "-c", check], { cwd: projectRoot, stdio: "pipe" });
});

test("el envío SMTP reintenta una caída pero no una credencial rechazada", () => {
  const check = `
import importlib.util
import smtplib
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("report", "scripts/analytics_report.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

config = {
    "smtp_host": "smtp.gmail.com", "smtp_port": 465,
    "smtp_user": "reporter@example.com", "smtp_password": "app-password",
    "sender": "reporter@example.com", "recipient": "marketing@laboratorioslira.com",
}

intentos = []
class Inestable:
    def __init__(self, *args, **kwargs):
        intentos.append(1)
        if len(intentos) < 3:
            raise smtplib.SMTPServerDisconnected("se cayó")
    def __enter__(self): return self
    def __exit__(self, *args): return False
    def login(self, *args): pass
    def send_message(self, message): self.enviado = message

with patch.object(module.time, "sleep", lambda *_: None):
    with patch.object(module.smtplib, "SMTP_SSL", Inestable):
        module.send_email("Asunto", "<p>x</p>", "x", config)
    assert len(intentos) == 3, intentos

    rechazos = []
    class Rechaza:
        def __init__(self, *args, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def login(self, *args):
            rechazos.append(1)
            raise smtplib.SMTPAuthenticationError(535, b"Username and Password not accepted")
        def send_message(self, message): pass
    with patch.object(module.smtplib, "SMTP_SSL", Rechaza):
        try:
            module.send_email("Asunto", "<p>x</p>", "x", config)
        except RuntimeError as error:
            assert "app-password" not in str(error), "el error no debe filtrar la contraseña"
        else:
            raise AssertionError("una credencial rechazada debe fallar")
    assert len(rechazos) == 1, f"no debe reintentar una contraseña inválida: {rechazos}"
`;
  execFileSync("python3", ["-B", "-c", check], { cwd: projectRoot, stdio: "pipe" });
});

// Un job cancelado por `timeout-minutes` NO dispara `if: failure()`, así que los
// reintentos deben rendirse antes de agotar el tiempo del job: si no, la única
// avería que de verdad importa —Google caído— sería también la más silenciosa.
test("los reintentos tienen un techo global y no pueden agotar el job", () => {
  const check = `
import importlib.util
from unittest.mock import patch
spec = importlib.util.spec_from_file_location("report", "scripts/analytics_report.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

assert module.RETRY_BUDGET_SECONDS > 0

with patch.object(module.time, "sleep", lambda *_: None):
    sin_presupuesto = module.RetryBudget(0.0)
    intentos = []
    def cae():
        intentos.append(1)
        raise module.TransientError("caída")
    try:
        module.with_retries(cae, "La consulta", budget=sin_presupuesto)
    except RuntimeError as error:
        assert "La consulta" in str(error)
    else:
        raise AssertionError("debe acabar fallando")
    assert len(intentos) == 1, f"sin presupuesto no debe reintentar: {intentos}"

    # El presupuesto es compartido: muchas llamadas seguidas no pueden sumar
    # más espera que el techo, por mucho que cada una tenga sus tres intentos.
    compartido = module.RetryBudget(12.0)
    total = []
    def registra(pausa):
        total.append(pausa)
    with patch.object(module.time, "sleep", registra):
        for _ in range(10):
            try:
                module.with_retries(cae, "La consulta", budget=compartido)
            except RuntimeError:
                pass
    assert sum(total) <= 12.0, f"el techo se desbordó: {total}"
`;
  execFileSync("python3", ["-B", "-c", check], { cwd: projectRoot, stdio: "pipe" });
});

test("el job deja margen entre el techo de reintentos y su propio timeout", () => {
  assert.match(workflow, /timeout-minutes:\s*(\d+)/);
  const minutes = Number(workflow.match(/timeout-minutes:\s*(\d+)/)[1]);
  const script = readFileSync(`${projectRoot}/scripts/analytics_report.py`, "utf8");
  const budget = Number(script.match(/RETRY_BUDGET_SECONDS\s*=\s*(\d+)/)[1]);
  assert.ok(budget > 0, "debe existir un techo de reintentos");
  assert.ok(
    minutes * 60 > budget * 2,
    `el timeout del job (${minutes} min) debe holgar sobre el techo de reintentos (${budget} s)`,
  );
});
