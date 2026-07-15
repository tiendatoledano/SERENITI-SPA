// ============================================================
// security.js - Sistema de Seguridad Blindado con Detección Inteligente
// ============================================================

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

// Archivos de seguridad
const ATAQUES_FILE = path.join(__dirname, 'ataques.json');
const BLOQUEOS_SEGURIDAD_FILE = path.join(__dirname, 'bloqueos-seguridad.json');
const IP_CONFIANZA_FILE = path.join(__dirname, 'ip-confianza.json');

// Variables en memoria
let ataquesMemoria = [];
let bloqueosMemoria = {};
let intentosLogin = new Map();
let ipConfianza = {};

// Rangos de IPs de operadores móviles
const RANGOS_MOVILES = {
    'CUB': ['179.0.0.0/8', '190.0.0.0/8', '200.0.0.0/8'],
    'ARG': ['181.0.0.0/8', '186.0.0.0/8', '190.0.0.0/8'],
    'MEX': ['187.0.0.0/8', '189.0.0.0/8', '200.0.0.0/8'],
    'COL': ['181.0.0.0/8', '186.0.0.0/8', '190.0.0.0/8'],
    'CHL': ['181.0.0.0/8', '186.0.0.0/8', '190.0.0.0/8'],
    'PER': ['181.0.0.0/8', '186.0.0.0/8', '190.0.0.0/8'],
    'ESP': ['185.0.0.0/8', '188.0.0.0/8', '193.0.0.0/8'],
    'USA': ['192.0.0.0/8', '198.0.0.0/8', '204.0.0.0/8'],
    'GLOBAL': ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']
};

// ============================================================
// INICIALIZACIÓN
// ============================================================
async function initSecurityFiles() {
    try {
        if (!fsSync.existsSync(ATAQUES_FILE)) {
            await fs.writeFile(ATAQUES_FILE, JSON.stringify([], null, 2));
        }
        if (!fsSync.existsSync(BLOQUEOS_SEGURIDAD_FILE)) {
            await fs.writeFile(BLOQUEOS_SEGURIDAD_FILE, JSON.stringify({}, null, 2));
        }
        if (!fsSync.existsSync(IP_CONFIANZA_FILE)) {
            await fs.writeFile(IP_CONFIANZA_FILE, JSON.stringify({}, null, 2));
        }
        
        const ataquesData = await fs.readFile(ATAQUES_FILE, 'utf8');
        ataquesMemoria = JSON.parse(ataquesData);
        
        const bloqueosData = await fs.readFile(BLOQUEOS_SEGURIDAD_FILE, 'utf8');
        bloqueosMemoria = JSON.parse(bloqueosData);
        
        const confianzaData = await fs.readFile(IP_CONFIANZA_FILE, 'utf8');
        ipConfianza = JSON.parse(confianzaData);
        
        console.log(`🛡️ Sistema de seguridad blindado iniciado`);
        console.log(`📊 Ataques registrados: ${ataquesMemoria.length}`);
        console.log(`🚫 IPs bloqueadas: ${Object.keys(bloqueosMemoria).length}`);
        console.log(`✅ IPs con confianza: ${Object.keys(ipConfianza).length}`);
    } catch (e) {
        console.error('❌ Error inicializando sistema de seguridad:', e);
    }
}

// ============================================================
// FUNCIONES UTILITARIAS
// ============================================================
function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2) + crypto.randomBytes(4).toString('hex');
}

function formatearTiempoRestante(ms) {
    if (ms <= 0) return 'Expirado';
    const horas = Math.floor(ms / 3600000);
    const minutos = Math.floor((ms % 3600000) / 60000);
    if (horas > 0) return `${horas}h ${minutos}m`;
    return `${minutos}m`;
}

function ipEnRango(ip, rangoCIDR) {
    try {
        const [rango, mascara] = rangoCIDR.split('/');
        const mascaraInt = parseInt(mascara);
        const ipPartes = ip.split('.');
        if (ipPartes.length !== 4) return false;
        const ipNum = (parseInt(ipPartes[0]) << 24) | (parseInt(ipPartes[1]) << 16) | (parseInt(ipPartes[2]) << 8) | parseInt(ipPartes[3]);
        const rangoPartes = rango.split('.');
        if (rangoPartes.length !== 4) return false;
        const rangoNum = (parseInt(rangoPartes[0]) << 24) | (parseInt(rangoPartes[1]) << 16) | (parseInt(rangoPartes[2]) << 8) | parseInt(rangoPartes[3]);
        const mascaraNum = ~((1 << (32 - mascaraInt)) - 1);
        return (ipNum & mascaraNum) === (rangoNum & mascaraNum);
    } catch (e) {
        return false;
    }
}

function esIPMovil(ip) {
    if (ip === 'localhost' || ip === '127.0.0.1' || ip === '::1') return false;
    for (const [pais, rangos] of Object.entries(RANGOS_MOVILES)) {
        for (const rango of rangos) {
            if (ipEnRango(ip, rango)) return true;
        }
    }
    return false;
}

async function esVPN(ip) {
    try {
        const vpnIPs = ['104.16.0.0', '104.17.0.0', '104.18.0.0', '104.19.0.0'];
        if (vpnIPs.includes(ip)) return true;
        const rangosVPN = ['103.0.0.0/8', '104.0.0.0/8', '107.0.0.0/8', '108.0.0.0/8'];
        for (const rango of rangosVPN) {
            if (ipEnRango(ip, rango)) return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

function getClientIP(req) {
    const forwarded = req.headers['x-forwarded-for'];
    let ip = forwarded ? forwarded.split(',')[0] : req.socket.remoteAddress;
    ip = ip.replace('::ffff:', '');
    if (ip === '127.0.0.1' || ip === '::1') ip = 'localhost';
    return ip;
}

// ============================================================
// SISTEMA DE CONFIANZA
// ============================================================
async function tieneConfianzaAlta(ip) {
    try {
        if (ip === 'localhost') return true;
        const datos = ipConfianza[ip];
        if (!datos) return false;
        const antiguedad = Date.now() - new Date(datos.primerVista).getTime();
        return antiguedad > 7 * 24 * 60 * 60 * 1000 && (datos.incidentes || 0) < 3;
    } catch (e) {
        return false;
    }
}

async function registrarActividadIP(ip, req) {
    try {
        if (ip === 'localhost') return;
        if (!ipConfianza[ip]) {
            ipConfianza[ip] = {
                primerVista: new Date().toISOString(),
                ultimaVista: new Date().toISOString(),
                incidentes: 0,
                visitas: 0,
                esMovil: esIPMovil(ip),
                esVPN: await esVPN(ip)
            };
        } else {
            ipConfianza[ip].ultimaVista = new Date().toISOString();
            ipConfianza[ip].visitas = (ipConfianza[ip].visitas || 0) + 1;
        }
        if (Object.keys(ipConfianza).length % 100 === 0) {
            await guardarConfianza();
        }
    } catch (e) {}
}

async function incrementarIncidentes(ip) {
    try {
        if (ip === 'localhost') return;
        if (!ipConfianza[ip]) {
            ipConfianza[ip] = {
                primerVista: new Date().toISOString(),
                ultimaVista: new Date().toISOString(),
                incidentes: 1,
                visitas: 1,
                esMovil: esIPMovil(ip),
                esVPN: await esVPN(ip)
            };
        } else {
            ipConfianza[ip].incidentes = (ipConfianza[ip].incidentes || 0) + 1;
        }
        await guardarConfianza();
    } catch (e) {}
}

async function guardarConfianza() {
    try {
        await fs.writeFile(IP_CONFIANZA_FILE, JSON.stringify(ipConfianza, null, 2));
    } catch (e) {}
}

// ============================================================
// SISTEMA DE BLOQUEO
// ============================================================
async function isIPBlocked(ip) {
    try {
        if (ip === 'localhost') return { bloqueado: false };
        const bloqueo = bloqueosMemoria[ip];
        if (!bloqueo) return { bloqueado: false };
        
        const esMovil = await esIPMovil(ip);
        const confianzaAlta = await tieneConfianzaAlta(ip);
        
        if (esMovil && confianzaAlta && !bloqueo.permanente) {
            const tiempoRestante = bloqueo.expiracion - Date.now();
            const nuevoTiempo = Math.floor(tiempoRestante * 0.5);
            bloqueo.expiracion = Date.now() + nuevoTiempo;
            await guardarBloqueos();
        }
        
        if (bloqueo.permanente) {
            if (esMovil && confianzaAlta) {
                bloqueo.permanente = false;
                bloqueo.expiracion = Date.now() + 60 * 60 * 1000;
                await guardarBloqueos();
                return { bloqueado: true, permanente: false, tiempoRestante: 60 * 60 * 1000, motivo: bloqueo.motivo, conteo: bloqueo.conteo };
            }
            return { bloqueado: true, permanente: true, motivo: bloqueo.motivo, conteo: bloqueo.conteo };
        }
        
        if (Date.now() < bloqueo.expiracion) {
            return { bloqueado: true, permanente: false, tiempoRestante: bloqueo.expiracion - Date.now(), motivo: bloqueo.motivo, conteo: bloqueo.conteo };
        } else {
            delete bloqueosMemoria[ip];
            await guardarBloqueos();
            return { bloqueado: false };
        }
    } catch (e) {
        return { bloqueado: false };
    }
}

async function registrarAtaque(ip, tipo, detalles, usuario = null, path = null) {
    try {
        const esMovil = await esIPMovil(ip);
        const confianzaAlta = await tieneConfianzaAlta(ip);
        const ataque = {
            id: generarId(),
            ip: ip,
            tipo: tipo,
            detalles: detalles + (esMovil && confianzaAlta ? ' (USUARIO MÓVIL - ADVERTENCIA)' : ''),
            usuario: usuario,
            path: path || 'unknown',
            fecha: new Date().toISOString(),
            resuelto: false,
            esMovil: esMovil,
            esAdvertencia: esMovil && confianzaAlta
        };
        ataquesMemoria.push(ataque);
        await guardarAtaques();
        await incrementarIncidentes(ip);
        return ataque;
    } catch (e) {
        return null;
    }
}

async function bloquearIP(ip, motivo, tipoAtaque, usuario = null, path = null) {
    try {
        if (ip === 'localhost') return null;
        
        const esMovil = await esIPMovil(ip);
        const confianzaAlta = await tieneConfianzaAlta(ip);
        
        let conteo = 0;
        if (bloqueosMemoria[ip]) conteo = bloqueosMemoria[ip].conteo || 0;
        conteo++;
        
        let limiteBloqueos = 3;
        if (esMovil && confianzaAlta) limiteBloqueos = 6;
        
        if (conteo >= limiteBloqueos) {
            if (tipoAtaque === 'SQL_INJECTION' || tipoAtaque === 'XSS_ATTACK' || tipoAtaque === 'COMMAND_INJECTION') {
                const bloqueo = { ip, conteo, motivo, tipoAtaque, usuario, path, permanente: true, expiracion: null, fechaBloqueo: new Date().toISOString(), esMovil };
                bloqueosMemoria[ip] = bloqueo;
                await guardarBloqueos();
                return { ip, conteo, permanente: true, duracionTexto: 'PERMANENTE', motivo };
            } else {
                const duracion = esMovil && confianzaAlta ? 2 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
                const bloqueo = { ip, conteo, motivo, tipoAtaque, usuario, path, permanente: false, expiracion: Date.now() + duracion, fechaBloqueo: new Date().toISOString(), esMovil };
                bloqueosMemoria[ip] = bloqueo;
                await guardarBloqueos();
                return { ip, conteo, permanente: false, duracionTexto: `${duracion / (60 * 60 * 1000)} horas`, motivo };
            }
        }
        
        let duracion = esMovil && confianzaAlta ? 30 * 60 * 1000 : conteo * 60 * 60 * 1000;
        const bloqueo = { ip, conteo, motivo, tipoAtaque, usuario, path, permanente: false, expiracion: Date.now() + duracion, fechaBloqueo: new Date().toISOString(), esMovil };
        bloqueosMemoria[ip] = bloqueo;
        await guardarBloqueos();
        return { ip, conteo, permanente: false, duracionTexto: `${conteo} hora${conteo > 1 ? 's' : ''}`, motivo };
    } catch (e) {
        return null;
    }
}

async function desbloquearIP(ip) {
    try {
        if (bloqueosMemoria[ip]) {
            delete bloqueosMemoria[ip];
            await guardarBloqueos();
            return true;
        }
        return false;
    } catch (e) {
        return false;
    }
}

async function guardarAtaques() {
    try {
        await fs.writeFile(ATAQUES_FILE, JSON.stringify(ataquesMemoria, null, 2));
    } catch (e) {}
}

async function guardarBloqueos() {
    try {
        await fs.writeFile(BLOQUEOS_SEGURIDAD_FILE, JSON.stringify(bloqueosMemoria, null, 2));
    } catch (e) {}
}

// ============================================================
// DETECTORES DE ATAQUES
// ============================================================
function detectarSQLInjection(valor) {
    if (typeof valor !== 'string') return false;
    const patrones = [
        /(\bUNION\b\s+\bALL\b|\bUNION\b)/i, /(\bSELECT\b.*\bFROM\b)/i,
        /(\bINSERT\b.*\bINTO\b)/i, /(\bUPDATE\b.*\bSET\b)/i,
        /(\bDELETE\b.*\bFROM\b)/i, /(\bDROP\b.*\bTABLE\b|\bDROP\b.*\bDATABASE\b)/i,
        /(\bALTER\b.*\bTABLE\b)/i, /(\bCREATE\b.*\bTABLE\b)/i,
        /(\bEXEC\b|\bEXECUTE\b)/i, /--/, /;/, /(\bOR\b\s+1\s*=\s*1)/i,
        /(\bOR\b\s+1\s*=\s*2)/i, /(\bAND\b\s+1\s*=\s*1)/i, /(\bAND\b\s+1\s*=\s*2)/i,
        /('.*\bOR\b.*'=')/i, /(\bSLEEP\b\s*\()/i, /(\bBENCHMARK\b\s*\()/i
    ];
    for (const patron of patrones) {
        if (patron.test(valor)) return true;
    }
    return false;
}

function detectarXSS(valor) {
    if (typeof valor !== 'string') return false;
    const patrones = [
        /<script/i, /javascript:/i, /onerror\s*=/i, /onload\s*=/i,
        /onclick\s*=/i, /onmouseover\s*=/i, /onmouseout\s*=/i,
        /onfocus\s*=/i, /onblur\s*=/i, /onchange\s*=/i, /onsubmit\s*=/i,
        /onreset\s*=/i, /onselect\s*=/i, /onkeydown\s*=/i, /onkeyup\s*=/i,
        /onkeypress\s*=/i, /alert\s*\(/i, /prompt\s*\(/i, /confirm\s*\(/i,
        /document\.cookie/i, /document\.location/i, /window\.location/i,
        /eval\s*\(/i, /setTimeout\s*\(/i, /setInterval\s*\(/i, /Function\s*\(/i
    ];
    for (const patron of patrones) {
        if (patron.test(valor)) return true;
    }
    return false;
}

function detectarPathTraversal(valor) {
    if (typeof valor !== 'string') return false;
    const patrones = [/\.\.\//, /\.\.\\/, /%2e%2e%2f/, /%2e%2e%5c/, /\.\.\/\.\./, /\.\.\\\.\./, /\/etc\/passwd/, /\/windows\/win\.ini/, /\/var\/log/, /\/root\//, /\/boot\//];
    for (const patron of patrones) {
        if (patron.test(valor)) return true;
    }
    return false;
}

function detectarCommandInjection(valor) {
    if (typeof valor !== 'string') return false;
    const patrones = [
        /;.*/, /\|.*/, /&.*/, /`.*`/, /\$\s*\(/, /\$(.*\))/, /rm\s+-rf/i,
        /wget\s+/i, /curl\s+/i, /nc\s+/i, /ncat\s+/i, /telnet\s+/i,
        /ssh\s+/i, /scp\s+/i, /sftp\s+/i, /ftp\s+/i, /chmod\s+/i,
        /chown\s+/i, /kill\s+/i, /pkill\s+/i, /system\s*\(/i,
        /exec\s*\(/i, /shell_exec\s*\(/i, /passthru\s*\(/i,
        /popen\s*\(/i, /proc_open\s*\(/i
    ];
    for (const patron of patrones) {
        if (patron.test(valor)) return true;
    }
    return false;
}

// ============================================================
// MIDDLEWARE DE SEGURIDAD
// ============================================================
async function seguridadMiddleware(req, res, next) {
    const ip = getClientIP(req);
    const path = req.path;
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    await registrarActividadIP(ip, req);
    
    const esMovil = await esIPMovil(ip);
    const confianzaAlta = await tieneConfianzaAlta(ip);
    
    const estadoBloqueo = await isIPBlocked(ip);
    if (estadoBloqueo.bloqueado) {
        const tiempoTexto = estadoBloqueo.permanente ? 'PERMANENTE' : formatearTiempoRestante(estadoBloqueo.tiempoRestante);
        return res.status(403).json({
            error: '🚫 Acceso denegado por razones de seguridad',
            codigo: 'SEC-403',
            motivo: estadoBloqueo.motivo,
            permanente: estadoBloqueo.permanente,
            tiempoRestante: tiempoTexto,
            ip: ip
        });
    }
    
    const botPatterns = /(bot|crawler|spider|scraper|curl|wget|python|perl|ruby|java|php|go|node|nikto|nmap|sqlmap|havij|acunetix|netsparker|burp|zap|dirbuster|gobuster|wfuzz|hydra|medusa|ncrack|xerxes|slowloris|hulk|goldeneye|ddos|attack|malicious|scanner|exploit|payload)/i;
    if (botPatterns.test(userAgent)) {
        await registrarAtaque(ip, 'BOT_DETECTED', `Bot malicioso detectado: ${userAgent}`, null, path);
    }
    
    const parametros = { ...req.body, ...req.query, ...req.params };
    for (const [key, value] of Object.entries(parametros)) {
        if (typeof value === 'string') {
            if (detectarSQLInjection(value)) {
                await registrarAtaque(ip, 'SQL_INJECTION', `Intento de inyección SQL en ${path} - Parámetro: ${key}=${value}`, null, path);
                if (esMovil && confianzaAlta) {
                    await incrementarIncidentes(ip);
                    return res.status(403).json({ error: '⚠️ Actividad sospechosa detectada. Por favor, verifica tus datos.', codigo: 'SEC-403-SQL-WARN', ip: ip });
                }
                await bloquearIP(ip, `Intento de inyección SQL detectado en ${path}`, 'SQL_INJECTION', null, path);
                return res.status(403).json({ error: '🚫 Actividad sospechosa detectada', codigo: 'SEC-403-SQL', ip: ip });
            }
            if (detectarXSS(value)) {
                await registrarAtaque(ip, 'XSS_ATTACK', `Intento de XSS en ${path} - Parámetro: ${key}=${value}`, null, path);
                if (esMovil && confianzaAlta) {
                    await incrementarIncidentes(ip);
                    return res.status(403).json({ error: '⚠️ Actividad sospechosa detectada. Por favor, verifica tus datos.', codigo: 'SEC-403-XSS-WARN', ip: ip });
                }
                await bloquearIP(ip, `Intento de XSS detectado en ${path}`, 'XSS_ATTACK', null, path);
                return res.status(403).json({ error: '🚫 Actividad sospechosa detectada', codigo: 'SEC-403-XSS', ip: ip });
            }
            if (detectarPathTraversal(value)) {
                await registrarAtaque(ip, 'PATH_TRAVERSAL', `Intento de Path Traversal en ${path} - Parámetro: ${key}=${value}`, null, path);
                if (esMovil && confianzaAlta) {
                    await incrementarIncidentes(ip);
                    return res.status(403).json({ error: '⚠️ Actividad sospechosa detectada. Por favor, verifica tus datos.', codigo: 'SEC-403-PATH-WARN', ip: ip });
                }
                await bloquearIP(ip, `Intento de Path Traversal detectado en ${path}`, 'PATH_TRAVERSAL', null, path);
                return res.status(403).json({ error: '🚫 Actividad sospechosa detectada', codigo: 'SEC-403-PATH', ip: ip });
            }
            if (detectarCommandInjection(value)) {
                await registrarAtaque(ip, 'COMMAND_INJECTION', `Intento de Command Injection en ${path} - Parámetro: ${key}=${value}`, null, path);
                if (esMovil && confianzaAlta) {
                    await incrementarIncidentes(ip);
                    return res.status(403).json({ error: '⚠️ Actividad sospechosa detectada. Por favor, verifica tus datos.', codigo: 'SEC-403-CMD-WARN', ip: ip });
                }
                await bloquearIP(ip, `Intento de Command Injection detectado en ${path}`, 'COMMAND_INJECTION', null, path);
                return res.status(403).json({ error: '🚫 Actividad sospechosa detectada', codigo: 'SEC-403-CMD', ip: ip });
            }
        }
    }
    
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
}

// ============================================================
// CONTROL DE FUERZA BRUTA
// ============================================================
function obtenerIntentosLogin(ip) {
    const ahora = Date.now();
    const ventana = 5 * 60 * 1000;
    if (!intentosLogin.has(ip)) {
        intentosLogin.set(ip, { intentos: 0, primerIntento: ahora });
        return 0;
    }
    const datos = intentosLogin.get(ip);
    if (ahora - datos.primerIntento > ventana) {
        intentosLogin.set(ip, { intentos: 0, primerIntento: ahora });
        return 0;
    }
    return datos.intentos;
}

function incrementarIntentosLogin(ip) {
    const ahora = Date.now();
    const ventana = 5 * 60 * 1000;
    if (!intentosLogin.has(ip)) {
        intentosLogin.set(ip, { intentos: 1, primerIntento: ahora });
        return 1;
    }
    const datos = intentosLogin.get(ip);
    if (ahora - datos.primerIntento > ventana) {
        intentosLogin.set(ip, { intentos: 1, primerIntento: ahora });
        return 1;
    }
    datos.intentos++;
    return datos.intentos;
}

// ============================================================
// RUTAS PARA ADMIN
// ============================================================
function getTipoAtaqueClase(tipo) {
    const clases = {
        'SQL_INJECTION': 'tag-danger',
        'XSS_ATTACK': 'tag-danger',
        'COMMAND_INJECTION': 'tag-danger',
        'PATH_TRAVERSAL': 'tag-danger',
        'BRUTE_FORCE': 'tag-warning',
        'BRUTE_FORCE_ATTEMPT': 'tag-warning',
        'BOT_DETECTED': 'tag-info',
        'ADMIN_MANUAL': 'tag-purple',
        'DIRECTORY_SCAN': 'tag-warning'
    };
    return clases[tipo] || 'tag-warning';
}

function getTopIPsAtacantes(limite = 5) {
    const ipCount = {};
    for (const a of ataquesMemoria) {
        ipCount[a.ip] = (ipCount[a.ip] || 0) + 1;
    }
    return Object.entries(ipCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limite)
        .map(([ip, count]) => ({ ip, count }));
}

async function getAtaques(req, res) {
    try {
        const ataquesFormateados = ataquesMemoria.map(a => ({
            ...a,
            fechaFormateada: new Date(a.fecha).toLocaleString(),
            tipoClase: getTipoAtaqueClase(a.tipo),
            esMovilTexto: a.esMovil ? '📱 Móvil' : '💻 Fijo'
        }));
        res.json(ataquesFormateados);
    } catch (e) {
        res.json([]);
    }
}

async function getBloqueos(req, res) {
    try {
        const bloqueosFormateados = Object.entries(bloqueosMemoria).map(([ip, info]) => ({
            ip: ip,
            ...info,
            tiempoRestanteFormateado: info.permanente ? 'PERMANENTE' : info.expiracion ? formatearTiempoRestante(info.expiracion - Date.now()) : 'Expirado',
            fechaBloqueoFormateada: new Date(info.fechaBloqueo).toLocaleString(),
            esMovilTexto: info.esMovil ? '📱 Móvil' : '💻 Fijo'
        }));
        res.json(bloqueosFormateados);
    } catch (e) {
        res.json([]);
    }
}

async function desbloquearIPAdmin(req, res) {
    try {
        const ip = req.params.ip;
        const exito = await desbloquearIP(ip);
        if (exito) {
            res.json({ success: true, message: 'IP desbloqueada correctamente' });
        } else {
            res.status(404).json({ error: 'IP no encontrada en la lista de bloqueos' });
        }
    } catch (e) {
        res.status(500).json({ error: 'Error al desbloquear IP' });
    }
}

async function bloquearIPAdmin(req, res) {
    try {
        const { ip, motivo, permanente } = req.body;
        if (!ip) return res.status(400).json({ error: 'IP requerida' });
        if (ip === 'localhost') return res.status(400).json({ error: 'No se puede bloquear localhost' });
        if (permanente) {
            const bloqueo = await bloquearIP(ip, motivo || 'Bloqueado manualmente por admin (PERMANENTE)', 'ADMIN_MANUAL');
            return res.json({ success: true, bloqueo });
        }
        const bloqueo = await bloquearIP(ip, motivo || 'Bloqueado manualmente por admin', 'ADMIN_MANUAL');
        res.json({ success: true, bloqueo });
    } catch (e) {
        res.status(500).json({ error: 'Error al bloquear IP' });
    }
}

async function resolverAtaque(req, res) {
    try {
        const id = req.params.id;
        const index = ataquesMemoria.findIndex(a => a.id === id);
        if (index === -1) return res.status(404).json({ error: 'Ataque no encontrado' });
        ataquesMemoria[index].resuelto = true;
        await guardarAtaques();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al resolver ataque' });
    }
}

async function eliminarAtaque(req, res) {
    try {
        const id = req.params.id;
        const index = ataquesMemoria.findIndex(a => a.id === id);
        if (index === -1) return res.status(404).json({ error: 'Ataque no encontrado' });
        ataquesMemoria.splice(index, 1);
        await guardarAtaques();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al eliminar ataque' });
    }
}

async function getEstadisticasSeguridad(req, res) {
    try {
        const totalAtaques = ataquesMemoria.length;
        const ataquesNoResueltos = ataquesMemoria.filter(a => !a.resuelto).length;
        const totalBloqueos = Object.keys(bloqueosMemoria).length;
        const bloqueosPermanentes = Object.values(bloqueosMemoria).filter(b => b.permanente).length;
        const bloqueosMoviles = Object.values(bloqueosMemoria).filter(b => b.esMovil).length;
        const tiposAtaque = {};
        for (const a of ataquesMemoria) {
            tiposAtaque[a.tipo] = (tiposAtaque[a.tipo] || 0) + 1;
        }
        const ipsConfianza = Object.keys(ipConfianza).filter(ip => 
            ipConfianza[ip] && (ipConfianza[ip].incidentes || 0) < 3 &&
            Date.now() - new Date(ipConfianza[ip].primerVista).getTime() > 7 * 24 * 60 * 60 * 1000
        ).length;
        res.json({
            totalAtaques,
            ataquesNoResueltos,
            totalBloqueos,
            bloqueosPermanentes,
            bloqueosMoviles,
            ipsConfianza,
            tiposAtaque,
            topIPsAtacantes: getTopIPsAtacantes(5)
        });
    } catch (e) {
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
}

// ============================================================
// EXPORTAR
// ============================================================
module.exports = {
    initSecurityFiles,
    seguridadMiddleware,
    getClientIP,
    isIPBlocked,
    registrarAtaque,
    bloquearIP,
    desbloquearIP,
    esIPMovil,
    esVPN,
    tieneConfianzaAlta,
    registrarActividadIP,
    incrementarIncidentes,
    obtenerIntentosLogin,
    incrementarIntentosLogin,
    getAtaques,
    getBloqueos,
    desbloquearIPAdmin,
    bloquearIPAdmin,
    resolverAtaque,
    eliminarAtaque,
    getEstadisticasSeguridad,
    ataquesMemoria,
    bloqueosMemoria,
    intentosLogin,
    ipConfianza
};