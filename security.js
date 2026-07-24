// ============================================================
// security.js - SISTEMA DE SEGURIDAD BLINDADO
// ============================================================

const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const BLOQUEOS_FILE = path.join(DATA_DIR, 'bloqueos.json');
const ATAQUES_FILE = path.join(DATA_DIR, 'ataques.json');
const LOGIN_INTENTOS_FILE = path.join(DATA_DIR, 'login_intentos.json');

// ============================================================
// INICIALIZACIÓN
// ============================================================
async function initSecurityFiles() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        
        for (const file of [BLOQUEOS_FILE, ATAQUES_FILE, LOGIN_INTENTOS_FILE]) {
            try {
                await fs.access(file);
            } catch {
                await fs.writeFile(file, JSON.stringify([]));
                console.log(`✅ Archivo creado: ${file}`);
            }
        }
        console.log('✅ Archivos de seguridad inicializados');
    } catch (error) {
        console.error('❌ Error inicializando archivos de seguridad:', error);
    }
}

// ============================================================
// FUNCIONES DE CARGA/GUARDADO
// ============================================================
async function loadJSON(file) {
    try {
        const data = await fs.readFile(file, 'utf8');
        return JSON.parse(data);
    } catch {
        return [];
    }
}

async function saveJSON(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}

// ============================================================
// OBTENER IP DEL CLIENTE
// ============================================================
function getClientIP(req) {
    const ip = req.headers['x-forwarded-for'] || 
               req.headers['cf-connecting-ip'] ||
               req.headers['x-real-ip'] ||
               req.connection?.remoteAddress ||
               req.socket?.remoteAddress ||
               req.ip ||
               'IP desconocida';
    
    // Si es IPv6 loopback o local, convertir a IPv4
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
        return '127.0.0.1';
    }
    
    // Si es IPv6 con prefijo ::ffff:, extraer IPv4
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    
    // Si hay múltiples IPs (x-forwarded-for), tomar la primera
    if (ip.includes(',')) {
        return ip.split(',')[0].trim();
    }
    
    return ip;
}

// ============================================================
// MIDDLEWARE DE SEGURIDAD
// ============================================================
async function seguridadMiddleware(req, res, next) {
    // Excluir rutas que no deben ser bloqueadas por este middleware
    const excludedPaths = ['/bloqueado', '/api/seguridad', '/api/verify', '/api/login', '/api/config-emailjs'];
    if (excludedPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    // Excluir archivos estáticos
    if (req.path.endsWith('.css') || req.path.endsWith('.js') || req.path.endsWith('.png') || 
        req.path.endsWith('.jpg') || req.path.endsWith('.svg') || req.path.endsWith('.ico') || 
        req.path.endsWith('.webp') || req.path.endsWith('.woff') || req.path.endsWith('.woff2')) {
        return next();
    }

    try {
        const ip = getClientIP(req);
        
        // Para pruebas locales, no bloquear
        if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('169.254.')) {
            return next();
        }
        
        const bloqueos = await getBloqueosActivos();
        const bloqueado = bloqueos.activos.some(b => b.ip === ip && !b.expirado);
        
        if (bloqueado) {
            console.log(`🛡️ IP BLOQUEADA: ${ip} - Acceso denegado a ${req.path}`);
            
            // Si es una solicitud AJAX/API, devolver 403
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(403).json({ 
                    error: 'Acceso cancelado',
                    mensaje: 'Su acceso ha sido cancelado en nuestro sistema por violación de los términos de uso.',
                    bloqueado: true
                });
            }
            
            // Redirigir a la página de bloqueo
            return res.redirect('/bloqueado');
        }
        
        next();
    } catch (error) {
        console.error('❌ Error en middleware de seguridad:', error);
        next();
    }
}

// ============================================================
// BLOQUEOS - CORREGIDO
// ============================================================

async function getBloqueos() {
    return await loadJSON(BLOQUEOS_FILE);
}

async function getBloqueosActivos() {
    try {
        const bloqueos = await loadJSON(BLOQUEOS_FILE);
        const ahora = Date.now();
        // Filtrar bloqueos activos (no expirados y con expiración futura)
        const activos = bloqueos.filter(b => {
            // Si expirado es true, está desactivado
            if (b.expirado === true) return false;
            // Si la expiración es menor que ahora, ya expiró
            if (b.expiracion && b.expiracion < ahora) return false;
            return true;
        });
        return { activos, todos: bloqueos };
    } catch (error) {
        console.error('❌ Error obteniendo bloqueos activos:', error);
        return { activos: [], todos: [] };
    }
}

async function bloquearIP(ip, motivo, tipoAtaque, duracionMs, ruta) {
    try {
        const bloqueos = await loadJSON(BLOQUEOS_FILE);
        
        // Verificar si ya está bloqueada (activa)
        const ahora = Date.now();
        const existe = bloqueos.some(b => 
            b.ip === ip && 
            !b.expirado && 
            b.expiracion > ahora
        );
        
        if (existe) {
            console.log(`⚠️ IP ${ip} ya está bloqueada`);
            return false;
        }
        
        // Eliminar bloqueos antiguos de la misma IP
        const filtrados = bloqueos.filter(b => b.ip !== ip);
        
        // Duración: 30 días por defecto (2592000000 ms)
        const duracion = duracionMs || 30 * 24 * 60 * 60 * 1000;
        const expiracion = ahora + duracion;
        
        const nuevoBloqueo = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
            ip: ip,
            motivo: motivo || 'Comportamiento sospechoso',
            tipoAtaque: tipoAtaque || 'ADMIN_BLOCK',
            fecha: new Date(ahora).toISOString(),
            expiracion: expiracion,
            expirado: false,
            ruta: ruta || '/admin',
            permanente: duracionMs === null || duracionMs === undefined
        };
        
        filtrados.push(nuevoBloqueo);
        await saveJSON(BLOQUEOS_FILE, filtrados);
        console.log(`🛡️ IP ${ip} bloqueada: ${motivo} (expira: ${new Date(expiracion).toISOString()})`);
        return true;
    } catch (error) {
        console.error('❌ Error bloqueando IP:', error);
        return false;
    }
}

async function desbloquearIPAdmin(ip) {
    try {
        const bloqueos = await loadJSON(BLOQUEOS_FILE);
        let encontrado = false;
        
        const actualizados = bloqueos.map(b => {
            if (b.ip === ip && !b.expirado) {
                encontrado = true;
                return { 
                    ...b, 
                    expirado: true, 
                    expiracion: Date.now() - 1000 
                };
            }
            return b;
        });
        
        if (encontrado) {
            await saveJSON(BLOQUEOS_FILE, actualizados);
            console.log(`🔓 IP ${ip} desbloqueada por admin`);
            return true;
        }
        console.log(`⚠️ IP ${ip} no encontrada en bloqueos activos`);
        return false;
    } catch (error) {
        console.error('❌ Error desbloqueando IP:', error);
        return false;
    }
}

async function bloquearIPAdmin(req, res) {
    try {
        const { ip, motivo, duracion } = req.body;
        
        if (!ip) {
            return res.status(400).json({ error: 'IP es requerida' });
        }
        
        const duracionMs = (duracion || 30) * 24 * 60 * 60 * 1000; // días a ms
        const resultado = await bloquearIP(ip, motivo || 'Bloqueado por admin', 'ADMIN_BLOCK', duracionMs, '/admin');
        
        if (resultado) {
            res.json({ success: true, mensaje: `IP ${ip} bloqueada` });
        } else {
            res.status(400).json({ error: 'La IP ya está bloqueada' });
        }
    } catch (error) {
        console.error('❌ Error en bloquearIPAdmin:', error);
        res.status(500).json({ error: 'Error al bloquear IP' });
    }
}

// ============================================================
// LOGIN INTENTOS
// ============================================================
async function incrementarIntentosLogin(ip) {
    try {
        const intentos = await loadJSON(LOGIN_INTENTOS_FILE);
        const ahora = Date.now();
        const limpiar = ahora - 300000; // 5 minutos
        
        // Limpiar intentos antiguos
        const filtrados = intentos.filter(i => i.timestamp > limpiar);
        
        // Buscar o crear entrada para esta IP
        let entrada = filtrados.find(i => i.ip === ip);
        if (entrada) {
            entrada.intentos += 1;
            entrada.timestamp = ahora;
        } else {
            entrada = { ip, intentos: 1, timestamp: ahora };
            filtrados.push(entrada);
        }
        
        await saveJSON(LOGIN_INTENTOS_FILE, filtrados);
        return entrada.intentos;
    } catch (error) {
        console.error('Error registrando intento de login:', error);
        return 0;
    }
}

// ============================================================
// ATAQUES
// ============================================================
async function getAtaques(req, res) {
    try {
        const ataques = await loadJSON(ATAQUES_FILE);
        res.json(ataques);
    } catch (error) {
        console.error('❌ Error en getAtaques:', error);
        res.status(500).json({ error: 'Error al cargar ataques' });
    }
}

async function getBloqueos(req, res) {
    try {
        const bloqueos = await getBloqueosActivos();
        res.json(bloqueos);
    } catch (error) {
        console.error('❌ Error en getBloqueos:', error);
        res.status(500).json({ error: 'Error al cargar bloqueos' });
    }
}

async function resolverAtaque(req, res) {
    try {
        const id = req.params.id;
        const ataques = await loadJSON(ATAQUES_FILE);
        const actualizados = ataques.map(a => {
            if (a.id === id) {
                return { ...a, resuelto: true, resuelto_en: new Date().toISOString() };
            }
            return a;
        });
        await saveJSON(ATAQUES_FILE, actualizados);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error en resolverAtaque:', error);
        res.status(500).json({ error: 'Error al resolver ataque' });
    }
}

async function eliminarAtaque(req, res) {
    try {
        const id = req.params.id;
        const ataques = await loadJSON(ATAQUES_FILE);
        const filtrados = ataques.filter(a => a.id !== id);
        await saveJSON(ATAQUES_FILE, filtrados);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error en eliminarAtaque:', error);
        res.status(500).json({ error: 'Error al eliminar ataque' });
    }
}

async function getEstadisticasSeguridad(req, res) {
    try {
        const bloqueos = await loadJSON(BLOQUEOS_FILE);
        const ataques = await loadJSON(ATAQUES_FILE);
        const ahora = Date.now();
        
        const activos = bloqueos.filter(b => !b.expirado && b.expiracion > ahora);
        const expirados = bloqueos.filter(b => b.expirado || b.expiracion <= ahora);
        
        res.json({
            total_bloqueos: bloqueos.length,
            activos: activos.length,
            expirados: expirados.length,
            total_ataques: ataques.length,
            ataques_resueltos: ataques.filter(a => a.resuelto).length
        });
    } catch (error) {
        console.error('❌ Error en getEstadisticasSeguridad:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
}

// ============================================================
// EXPORTAR
// ============================================================
module.exports = {
    initSecurityFiles,
    getClientIP,
    seguridadMiddleware,
    getBloqueos,
    getBloqueosActivos,
    bloquearIP,
    desbloquearIPAdmin,
    bloquearIPAdmin,
    incrementarIntentosLogin,
    getAtaques,
    getBloqueos,
    resolverAtaque,
    eliminarAtaque,
    getEstadisticasSeguridad
};