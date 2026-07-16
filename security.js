// security.js - SISTEMA DE SEGURIDAD BLINDADO
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const BLOQUEOS_FILE = path.join(DATA_DIR, 'bloqueos.json');
const ATAQUES_FILE = path.join(DATA_DIR, 'ataques.json');
const LOG_FILE = path.join(DATA_DIR, 'security.log');

// Inicializar archivos de seguridad
async function initSecurityFiles() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        for (const file of [BLOQUEOS_FILE, ATAQUES_FILE]) {
            try {
                await fs.access(file);
            } catch {
                await fs.writeFile(file, JSON.stringify([]));
            }
        }
        
        try {
            await fs.access(LOG_FILE);
        } catch {
            await fs.writeFile(LOG_FILE, '');
        }
        
        console.log('🛡️ Archivos de seguridad inicializados');
    } catch (error) {
        console.error('❌ Error inicializando archivos de seguridad:', error);
    }
}

// Obtener IP del cliente
function getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
           req.headers['x-real-ip'] || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip || 
           '0.0.0.0';
}

// Leer bloqueos
async function getBloqueos() {
    try {
        const data = await fs.readFile(BLOQUEOS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Guardar bloqueos
async function saveBloqueos(bloqueos) {
    await fs.writeFile(BLOQUEOS_FILE, JSON.stringify(bloqueos, null, 2));
}

// Leer ataques
async function getAtaques() {
    try {
        const data = await fs.readFile(ATAQUES_FILE, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

// Guardar ataques
async function saveAtaques(ataques) {
    await fs.writeFile(ATAQUES_FILE, JSON.stringify(ataques, null, 2));
}

// Registrar en log
async function logSecurity(message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message} ${JSON.stringify(data)}\n`;
    try {
        await fs.appendFile(LOG_FILE, logEntry);
    } catch (e) {
        console.error('Error escribiendo log de seguridad:', e);
    }
}

// Verificar si IP está bloqueada
async function isIPBloqueada(ip) {
    if (!ip) return false;
    const bloqueos = await getBloqueos();
    const ahora = Date.now();
    const activos = bloqueos.filter(b => {
        if (b.permanente) return true;
        if (b.expiracion && b.expiracion > ahora) return true;
        return false;
    });
    return activos.some(b => b.ip === ip);
}

// Bloquear IP
async function bloquearIP(ip, motivo, tipoAtaque = 'DESCONOCIDO', duracionHoras = 24, endpoint = '') {
    if (!ip || ip === '0.0.0.0' || ip === '::1' || ip === '127.0.0.1') {
        return { success: false, mensaje: 'No se puede bloquear IP local' };
    }
    
    const bloqueos = await getBloqueos();
    const existente = bloqueos.find(b => b.ip === ip);
    
    if (existente) {
        if (existente.permanente) {
            return { success: false, mensaje: 'IP ya está bloqueada permanentemente' };
        }
        // Renovar
        existente.expiracion = Date.now() + duracionHoras * 3600000;
        existente.motivo = motivo;
        existente.tipoAtaque = tipoAtaque;
        await saveBloqueos(bloqueos);
        await logSecurity(`BLOQUEO RENOVADO: ${ip}`, { motivo, tipoAtaque, duracionHoras });
        return { success: true, mensaje: `Bloqueo renovado para ${ip}` };
    }
    
    const nuevoBloqueo = {
        ip: ip,
        motivo: motivo,
        tipoAtaque: tipoAtaque,
        fecha: Date.now(),
        expiracion: Date.now() + duracionHoras * 3600000,
        permanente: false,
        endpoint: endpoint || 'desconocido'
    };
    
    bloqueos.push(nuevoBloqueo);
    await saveBloqueos(bloqueos);
    await logSecurity(`NUEVO BLOQUEO: ${ip}`, { motivo, tipoAtaque, duracionHoras, endpoint });
    return { success: true, mensaje: `IP ${ip} bloqueada por ${duracionHoras} horas` };
}

// Desbloquear IP
async function desbloquearIP(ip) {
    const bloqueos = await getBloqueos();
    const filtrados = bloqueos.filter(b => b.ip !== ip);
    await saveBloqueos(filtrados);
    await logSecurity(`DESBLOQUEO: ${ip}`, {});
    return { success: true };
}

// INCREMENTAR INTENTOS DE LOGIN (MEMORIA VOLÁTIL)
const intentosLogin = new Map();

function incrementarIntentosLogin(ip) {
    const ahora = Date.now();
    const registro = intentosLogin.get(ip) || { intentos: 0, timestamp: ahora };
    
    // Resetear si pasaron más de 5 minutos
    if (ahora - registro.timestamp > 300000) {
        registro.intentos = 0;
        registro.timestamp = ahora;
    }
    
    registro.intentos++;
    intentosLogin.set(ip, registro);
    return registro.intentos;
}

// MIDDLEWARE DE SEGURIDAD
async function seguridadMiddleware(req, res, next) {
    // Excluir archivos estáticos y assets
    if (req.path.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf)$/)) {
        return next();
    }
    
    // Excluir algunas rutas públicas
    if (req.path === '/' || 
        req.path === '/login.html' || 
        req.path === '/registro.html' ||
        req.path === '/terminos.html' ||
        req.path === '/asistente.html' ||
        req.path === '/api/config-emailjs' ||
        req.path === '/api/testimonios' ||
        req.path === '/api/servicios' ||
        req.path === '/api/verify/user' ||
        req.path === '/turnos' ||
        req.path === '/api/registro/guardar-codigo' ||
        req.path === '/api/registro/verificar-codigo' ||
        req.path === '/api/config/horarios' ||
        req.path === '/api/config/modalidades' ||
        req.path === '/api/seguridad/paises' ||
        req.path === '/api/horarios-disponibles') {
        return next();
    }
    
    // Obtener IP
    const ip = getClientIP(req);
    
    // Verificar si IP está bloqueada
    if (await isIPBloqueada(ip)) {
        await logSecurity(`BLOQUEADO: ${ip} intentó acceder a ${req.path}`, { path: req.path });
        return res.status(403).json({ 
            error: 'Acceso bloqueado por seguridad. Contacta al administrador.' 
        });
    }
    
    next();
}

// ============================================================
// RUTAS DE ADMIN (con verifyAuth)
// ============================================================

// Obtener ataques registrados
async function getAtaquesHandler(req, res) {
    try {
        const ataques = await getAtaques();
        res.json(ataques);
    } catch (e) {
        res.status(500).json({ error: 'Error obteniendo ataques' });
    }
}

// Obtener bloqueos activos
async function getBloqueosHandler(req, res) {
    try {
        const bloqueos = await getBloqueos();
        const ahora = Date.now();
        const activos = bloqueos.filter(b => {
            if (b.permanente) return true;
            if (b.expiracion && b.expiracion > ahora) return true;
            return false;
        });
        res.json({ activos, historial: bloqueos });
    } catch (e) {
        res.status(500).json({ error: 'Error obteniendo bloqueos' });
    }
}

// Desbloquear IP (admin)
async function desbloquearIPAdmin(req, res) {
    try {
        const ip = req.params.ip;
        await desbloquearIP(ip);
        res.json({ success: true, mensaje: `IP ${ip} desbloqueada` });
    } catch (e) {
        res.status(500).json({ error: 'Error desbloqueando IP' });
    }
}

// Bloquear IP manualmente (admin)
async function bloquearIPAdmin(req, res) {
    try {
        const { ip, motivo, duracionHoras } = req.body;
        if (!ip) return res.status(400).json({ error: 'IP requerida' });
        const resultado = await bloquearIP(ip, motivo || 'Bloqueo manual', 'MANUAL', duracionHoras || 24);
        res.json(resultado);
    } catch (e) {
        res.status(500).json({ error: 'Error bloqueando IP' });
    }
}

// Resolver ataque (marcar como resuelto)
async function resolverAtaque(req, res) {
    try {
        const id = req.params.id;
        const ataques = await getAtaques();
        const ataque = ataques.find(a => a.id === id);
        if (ataque) {
            ataque.resuelto = true;
            ataque.fecha_resolucion = Date.now();
            await saveAtaques(ataques);
        }
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error resolviendo ataque' });
    }
}

// Eliminar ataque
async function eliminarAtaque(req, res) {
    try {
        const id = req.params.id;
        const ataques = await getAtaques();
        const filtrados = ataques.filter(a => a.id !== id);
        await saveAtaques(filtrados);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error eliminando ataque' });
    }
}

// Estadísticas de seguridad
async function getEstadisticasSeguridad(req, res) {
    try {
        const bloqueos = await getBloqueos();
        const ataques = await getAtaques();
        const ahora = Date.now();
        
        const activos = bloqueos.filter(b => {
            if (b.permanente) return true;
            if (b.expiracion && b.expiracion > ahora) return true;
            return false;
        });
        
        const ultimaHora = ataques.filter(a => a.fecha && (ahora - a.fecha) < 3600000);
        
        res.json({
            totalBloqueos: bloqueos.length,
            bloqueosActivos: activos.length,
            totalAtaques: ataques.length,
            ataquesUltimaHora: ultimaHora.length,
            ataquesResueltos: ataques.filter(a => a.resuelto).length
        });
    } catch (e) {
        res.status(500).json({ error: 'Error obteniendo estadísticas' });
    }
}

module.exports = {
    initSecurityFiles,
    getClientIP,
    getBloqueos,
    saveBloqueos,
    getAtaques,
    saveAtaques,
    logSecurity,
    isIPBloqueada,
    bloquearIP,
    desbloquearIP,
    incrementarIntentosLogin,
    seguridadMiddleware,
    getAtaquesHandler,
    getBloqueosHandler,
    desbloquearIPAdmin,
    bloquearIPAdmin,
    resolverAtaque,
    eliminarAtaque,
    getEstadisticasSeguridad,
    // Alias para compatibilidad
    getAtaques: getAtaquesHandler,
    getBloqueos: getBloqueosHandler,
    desbloquearIPAdmin,
    bloquearIPAdmin,
    resolverAtaque,
    eliminarAtaque,
    getEstadisticasSeguridad
};