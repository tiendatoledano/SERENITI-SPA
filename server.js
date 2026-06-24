const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
const OpenAI = require('openai');

// Intentar importar Supabase, pero no fallar si no está instalado
let supabase = null;
let supabaseClient = null;

try {
    const { createClient } = require('@supabase/supabase-js');
    supabaseClient = createClient;
    
    const SUPABASE_URL = process.env.SUPABASE_URL || '';
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_ANON_KEY || '';
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        supabase = supabaseClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
        console.log('✅ Supabase inicializado correctamente');
    } else {
        console.warn('⚠️ Supabase no configurado. Usando almacenamiento local.');
    }
} catch (e) {
    console.warn('⚠️ Módulo @supabase/supabase-js no encontrado. Usando almacenamiento local.');
}

const app = express();
const PORT = process.env.PORT || 5001;
const BASE_DIR = __dirname;

// ============================================================
// ARCHIVOS Y DIRECTORIOS
// ============================================================
const IS_RENDER = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
const DATA_DIR = IS_RENDER ? '/tmp/data' : __dirname;

if (!fsSync.existsSync(DATA_DIR)) {
    fsSync.mkdirSync(DATA_DIR, { recursive: true });
}

const TURNOS_FILE = path.join(DATA_DIR, 'turnos.json');
const SERVICIOS_FILE = path.join(DATA_DIR, 'servicios.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const BLOQUEOS_FILE = path.join(DATA_DIR, 'bloqueos.json');
const PAISES_FILE = path.join(DATA_DIR, 'paises.json');
const HORARIOS_FILE = path.join(DATA_DIR, 'horarios.json');
const PALABRAS_BANEADAS_FILE = path.join(DATA_DIR, 'palabras-baneadas.json');
const REGISTRO_FILE = path.join(DATA_DIR, 'registro-config.json');
const BLOQUEOS_HISTORICOS_FILE = path.join(DATA_DIR, 'bloqueos-historicos.json');

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

if (!fsSync.existsSync(UPLOADS_DIR)) {
    fsSync.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use('/uploads', express.static(UPLOADS_DIR));

app.disable('x-powered-by');
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(BASE_DIR));

// ============================================================
// CONSTANTES
// ============================================================
let HORAS_VALIDAS = [12, 16, 20];
let DIAS_VALIDOS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
let serviciosData = [];
let horariosConfig = {
    dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
    horarios: ['12:00', '16:00', '20:00']
};
let ubicacionSalonGlobal = 'Salón Serenity Spa';

// ============================================================
// PALABRAS PROHIBIDAS
// ============================================================
let palabrasBaneadas = [
    'puta', 'puto', 'puta madre', 'putamadre', 'hijodeputa', 'hijo de puta',
    'mierda', 'coño', 'carajo', 'verga', 'chinga', 'chingue', 'chingada',
    'fuck', 'shit', 'bitch', 'asshole', 'motherfucker', 'cunt',
    'idiota', 'estupido', 'imbecil', 'tarado', 'estúpido', 'imbécil',
    'pendejo', 'cabron', 'cabrón', 'malparido', 'gonorrea', 'carechimba',
    'culo', 'cojones', 'pelotudo', 'boludo', 'forro', 'marica', 'maricon',
    'singao', 'singa', 'hp', 'h.p', 'malparido', 'malparida',
    'zorra', 'zorro', 'prostituta', 'perra', 'loca', 'loquita'
];

// ============================================================
// SISTEMA DE BLOQUEOS
// ============================================================
let bloqueos = new Map();
let historialBloqueos = [];
let intentosFallidos = new Map();
let cancelacionesPorIP = new Map();
let turnosRecientesIP = new Map();
let infraccionesPorIP = new Map();
let bloqueosHistoricosIP = new Map();

function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2) + crypto.randomBytes(4).toString('hex');
}

function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtT(ms) {
    if (ms <= 0) return 'Expirado';
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function generarCodigoCancelacion() {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < 6; i++) {
        codigo += caracteres[Math.floor(Math.random() * caracteres.length)];
    }
    return codigo;
}

function formatearTiempoRestante(ms) {
    if (ms <= 0) return 'Expirado';
    const horas = Math.floor(ms / 3600000);
    const minutos = Math.floor((ms % 3600000) / 60000);
    if (horas > 0) {
        return `${horas}h ${minutos}m`;
    }
    return `${minutos}m`;
}

function contienePalabraProhibida(texto) {
    if (!texto || typeof texto !== 'string') return null;
    const textoLower = texto.toLowerCase().trim();
    for (const palabra of palabrasBaneadas) {
        if (textoLower.includes(palabra.toLowerCase())) {
            return palabra;
        }
    }
    return null;
}

function validarNombreCompleto(nombre) {
    if (!nombre || typeof nombre !== 'string') return { valido: false, motivo: 'Nombre inválido' };
    const nombreTrim = nombre.trim();
    if (nombreTrim.length < 2) return { valido: false, motivo: 'El nombre debe tener al menos 2 caracteres' };
    if (nombreTrim.length > 60) return { valido: false, motivo: 'El nombre es demasiado largo (máx 60 caracteres)' };
    if (/^[\d\s]+$/.test(nombreTrim)) return { valido: false, motivo: 'El nombre debe contener letras' };
    const palabra = contienePalabraProhibida(nombreTrim);
    if (palabra) return { valido: false, motivo: `El nombre contiene la palabra prohibida: "${palabra}"`, palabra: palabra };
    return { valido: true };
}

function validarTelefonoCompleto(telefono) {
    if (!telefono || typeof telefono !== 'string') return { valido: false, motivo: 'Teléfono inválido' };
    const soloNumeros = telefono.replace(/\D/g, '');
    if (soloNumeros.length < 7) return { valido: false, motivo: 'El teléfono debe tener al menos 7 dígitos' };
    if (soloNumeros.length > 15) return { valido: false, motivo: 'El teléfono es demasiado largo (máx 15 dígitos)' };
    if (/^(\d)\1+$/.test(soloNumeros)) return { valido: false, motivo: 'El teléfono no puede ser una secuencia repetida' };
    if (/^1234567/.test(soloNumeros) || /^8765432/.test(soloNumeros) || /^0123456/.test(soloNumeros) || /^9876543/.test(soloNumeros)) {
        return { valido: false, motivo: 'El teléfono no puede ser una secuencia común' };
    }
    return { valido: true, numero: soloNumeros };
}

function validarDireccionCompleta(direccion) {
    if (!direccion || typeof direccion !== 'string') return { valido: false, motivo: 'Dirección inválida' };
    const direccionTrim = direccion.trim();
    if (direccionTrim.length < 5) return { valido: false, motivo: 'La dirección debe tener al menos 5 caracteres' };
    const palabra = contienePalabraProhibida(direccionTrim);
    if (palabra) return { valido: false, motivo: `La dirección contiene la palabra prohibida: "${palabra}"`, palabra: palabra };
    return { valido: true };
}

// ============================================================
// BLOQUEOS ACUMULATIVOS
// ============================================================
function obtenerConteoBloqueos(ip) {
    const ipLimpia = ip.replace('::ffff:', '');
    if (!bloqueosHistoricosIP.has(ipLimpia)) return 0;
    return bloqueosHistoricosIP.get(ipLimpia).count || 0;
}

function incrementarConteoBloqueos(ip) {
    const ipLimpia = ip.replace('::ffff:', '');
    if (!bloqueosHistoricosIP.has(ipLimpia)) {
        bloqueosHistoricosIP.set(ipLimpia, { count: 0, ultimoBloqueo: Date.now() });
    }
    const data = bloqueosHistoricosIP.get(ipLimpia);
    data.count = (data.count || 0) + 1;
    data.ultimoBloqueo = Date.now();
    return data.count;
}

async function cargarBloqueosHistoricos() {
    try {
        if (fsSync.existsSync(BLOQUEOS_HISTORICOS_FILE)) {
            const data = JSON.parse(await fs.readFile(BLOQUEOS_HISTORICOS_FILE, 'utf8'));
            bloqueosHistoricosIP = new Map(Object.entries(data));
        }
    } catch(e) {
        console.error('Error cargando bloqueos históricos:', e);
    }
}

function bloquearIPConAcumulativo(ip, motivo, tipo, palabraOfensiva, permanente = false) {
    const ipLimpia = ip.replace('::ffff:', '');
    let conteo = obtenerConteoBloqueos(ipLimpia);
    let duracion = 3600000;
    if (permanente) {
        duracion = 31536000000;
    } else {
        conteo = incrementarConteoBloqueos(ipLimpia);
        if (conteo >= 3) {
            duracion = 31536000000;
            permanente = true;
        } else if (conteo === 2) {
            duracion = 7200000;
        } else {
            duracion = 3600000;
        }
    }
    const hasta = Date.now() + duracion;
    bloqueos.set(ipLimpia, {
        hasta: hasta,
        motivo: motivo || (permanente ? 'Bloqueo PERMANENTE' : `Bloqueo por ${conteo}ra vez`),
        tipoAtaque: tipo || 'BLOQUEO_ADMIN',
        fecha: new Date().toISOString(),
        ip: ipLimpia,
        permanente: permanente,
        palabraOfensiva: palabraOfensiva || null,
        conteoBloqueos: conteo
    });
    historialBloqueos.unshift({ ...bloqueos.get(ipLimpia), id: generarId(), intentos: 0, conteoBloqueos: conteo });
    console.log(`🔴 IP BLOQUEADA: ${ipLimpia} - ${motivo} (${conteo}ra vez)`);
    return ipLimpia;
}

function estaBloqueado(ip) {
    const ipLimpia = ip.replace('::ffff:', '');
    if (bloqueos.has(ipLimpia)) {
        const datos = bloqueos.get(ipLimpia);
        if (datos.permanente) return true;
        if (Date.now() < datos.hasta) return true;
        bloqueos.delete(ipLimpia);
        return false;
    }
    return false;
}

function obtenerBloqueo(ip) {
    const ipLimpia = ip.replace('::ffff:', '');
    if (bloqueos.has(ipLimpia)) {
        const datos = bloqueos.get(ipLimpia);
        if (datos.permanente) return datos;
        if (Date.now() < datos.hasta) return datos;
        bloqueos.delete(ipLimpia);
        return null;
    }
    return null;
}

// ============================================================
// FUNCIONES DE INICIALIZACIÓN
// ============================================================
async function initAllFiles() {
    console.log('🔧 Inicializando archivos en:', DATA_DIR);
    if (!fsSync.existsSync(SERVICIOS_FILE)) {
        const serviciosDefault = [
            { id: generarId(), nombre: "Masaje Relajante", precio: "$45", descripcion: "Movimientos suaves para liberar el estrés.", beneficios: ["60 Minutos"], efectos: ["Relajación profunda"], imagenWeb: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800", imagenWhatsApp: "https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg", orden: 1 },
            { id: generarId(), nombre: "Masaje Corporal", precio: "$65", descripcion: "Tratamiento completo para una relajación profunda.", beneficios: ["90 Minutos"], efectos: ["Activación linfática"], imagenWeb: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800", imagenWhatsApp: "https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg", orden: 2 },
            { id: generarId(), nombre: "Masaje Facial", precio: "$40", descripcion: "Rejuvenece la piel y alivia la tensión facial.", beneficios: ["45 Minutos"], efectos: ["Estimula colágeno"], imagenWeb: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800", imagenWhatsApp: "https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg", orden: 3 }
        ];
        await fs.writeFile(SERVICIOS_FILE, JSON.stringify(serviciosDefault, null, 2));
        console.log('✅ servicios.json creado');
    }
    if (!fsSync.existsSync(TURNOS_FILE)) {
        await fs.writeFile(TURNOS_FILE, JSON.stringify([], null, 2));
        console.log('✅ turnos.json creado');
    }
    if (!fsSync.existsSync(HORARIOS_FILE)) {
        await fs.writeFile(HORARIOS_FILE, JSON.stringify(horariosConfig, null, 2));
        console.log('✅ horarios.json creado');
    }
    if (!fsSync.existsSync(PAISES_FILE)) {
        await fs.writeFile(PAISES_FILE, JSON.stringify({ autorizados: [], bloqueados: [], modo: 'todos', ubicacionSalon: 'Salón Serenity Spa' }, null, 2));
        console.log('✅ paises.json creado');
    }
    if (!fsSync.existsSync(PALABRAS_BANEADAS_FILE)) {
        await fs.writeFile(PALABRAS_BANEADAS_FILE, JSON.stringify({ palabras: palabrasBaneadas }, null, 2));
        console.log('✅ palabras-baneadas.json creado');
    }
    await cargarBloqueosHistoricos();
    if (fsSync.existsSync(BLOQUEOS_FILE)) {
        try {
            const data = JSON.parse(await fs.readFile(BLOQUEOS_FILE, 'utf8'));
            bloqueos = new Map(Object.entries(data.bloqueos || {}));
            historialBloqueos = data.historial || [];
            const ahora = Date.now();
            for (const [ip, datos] of bloqueos) {
                if (ahora > datos.hasta && !datos.permanente) bloqueos.delete(ip);
            }
        } catch(e) {
            console.error('Error cargando bloqueos:', e);
        }
    }
    try {
        const data = await fs.readFile(SERVICIOS_FILE, 'utf8');
        serviciosData = JSON.parse(data);
    } catch(e) {
        console.error('Error cargando servicios:', e);
        serviciosData = [];
    }
    try {
        const paisesData = JSON.parse(await fs.readFile(PAISES_FILE, 'utf8'));
        if (paisesData.ubicacionSalon) {
            ubicacionSalonGlobal = paisesData.ubicacionSalon;
        }
    } catch(e) {
        console.warn('Error cargando ubicación del salón:', e);
    }
    console.log(`✅ Servicios cargados: ${serviciosData.length}`);
    console.log(`🔒 Bloqueos activos: ${bloqueos.size}`);
    console.log(`📍 Ubicación del salón: ${ubicacionSalonGlobal}`);
}

// ============================================================
// MIDDLEWARE DE BLOQUEO
// ============================================================
app.use((req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || '0.0.0.0';
    const rutasPermitidas = [
        '/admin', '/admin.html', '/login', '/login.html', '/api/login', '/api/verify', '/admin-emergencia',
        '/api/seguridad/estado/current', '/api/seguridad/estado', '/api/seguridad/bloqueos', '/api/seguridad/desbloquear',
        '/api/seguridad/historial', '/api/seguridad/limpiar-expirados', '/api/seguridad/bloquear-permanente',
        '/api/seguridad/paises', '/api/seguridad/paises/autorizar', '/api/seguridad/paises/bloquear',
        '/api/seguridad/historial-ip', '/api/seguridad/verificar-vpn', '/api/palabras-baneadas', '/api/config',
        '/api/config/horarios', '/api/config/registro', '/api/servicios', '/api/upload-hero', '/api/ia',
        '/api/recargar', '/api/enviar-whatsapp', '/api/seguridad/infraccion', '/api/config-frontend',
        '/api/seguridad/bloquear-usuario', '/api/premium/usuario'
    ];
    for (const ruta of rutasPermitidas) {
        if (req.path.startsWith(ruta)) return next();
    }
    if (estaBloqueado(ip)) {
        const bloqueo = obtenerBloqueo(ip);
        console.log(`🚫 Acceso denegado a IP bloqueada: ${ip} - ${bloqueo?.motivo}`);
        return res.status(403).json({ error: 'Servicio restringido', bloqueado: true });
    }
    next();
});

// ============================================================
// RUTAS HTML
// ============================================================
app.get('/', (req, res) => res.sendFile(path.join(BASE_DIR, 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(BASE_DIR, 'admin.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(BASE_DIR, 'admin.html')));
app.get('/login', (req, res) => res.sendFile(path.join(BASE_DIR, 'login.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(BASE_DIR, 'login.html')));
app.get('/registro', (req, res) => res.sendFile(path.join(BASE_DIR, 'registro.html')));
app.get('/registro.html', (req, res) => res.sendFile(path.join(BASE_DIR, 'registro.html')));

// ============================================================
// RUTA DE EMERGENCIA
// ============================================================
app.get('/admin-emergencia/:token', (req, res) => {
    const { token } = req.params;
    if (token === 'SERENITY2024') {
        const ip = req.ip || req.socket.remoteAddress || '0.0.0.0';
        const ipLimpia = ip.replace('::ffff:', '');
        if (bloqueos.has(ipLimpia)) {
            bloqueos.delete(ipLimpia);
            return res.send(`<h1 style="color:green;">✅ IP ${ipLimpia} desbloqueada</h1><a href="/admin.html">Ir al Admin</a>`);
        }
        return res.send(`<h1>ℹ️ IP no estaba bloqueada</h1><a href="/admin.html">Ir al Admin</a>`);
    }
    res.status(404).send('Acceso denegado');
});

// ============================================================
// SERVICIOS
// ============================================================
app.get('/api/servicios', (req, res) => {
    try {
        const sorted = [...serviciosData].sort((a, b) => (a.orden || 999) - (b.orden || 999));
        res.json(sorted);
    } catch(e) {
        res.status(500).json({ error: 'Error al obtener servicios' });
    }
});

app.post('/api/servicios', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    try {
        const { nombre, precio, descripcion, beneficios, efectos, imagenWeb, imagenWhatsApp, videoUrl } = req.body;
        if (!nombre || !precio || !descripcion) return res.status(400).json({ error: 'Nombre, precio y descripción son obligatorios' });
        const nuevoServicio = {
            id: generarId(),
            nombre: nombre.trim(),
            precio: precio.trim(),
            descripcion: descripcion.trim(),
            beneficios: beneficios || [],
            efectos: efectos || [],
            imagenWeb: imagenWeb || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
            imagenWhatsApp: imagenWhatsApp || '',
            videoUrl: videoUrl || '',
            orden: serviciosData.length + 1
        };
        serviciosData.push(nuevoServicio);
        await fs.writeFile(SERVICIOS_FILE, JSON.stringify(serviciosData, null, 2));
        res.status(201).json(nuevoServicio);
    } catch (e) {
        res.status(500).json({ error: 'Error al crear el servicio' });
    }
});

app.put('/api/servicios/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    try {
        const id = req.params.id;
        const { nombre, precio, descripcion, beneficios, efectos, imagenWeb, imagenWhatsApp, videoUrl } = req.body;
        let index = serviciosData.findIndex(s => s.id === id);
        if (index === -1) index = serviciosData.findIndex(s => s._id === id);
        if (index === -1) return res.status(404).json({ error: 'Servicio no encontrado' });
        const idOriginal = serviciosData[index].id || serviciosData[index]._id || id;
        serviciosData[index] = {
            ...serviciosData[index],
            id: idOriginal,
            nombre: nombre.trim(),
            precio: precio.trim(),
            descripcion: descripcion.trim(),
            beneficios: beneficios || [],
            efectos: efectos || [],
            imagenWeb: imagenWeb || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
            imagenWhatsApp: imagenWhatsApp || '',
            videoUrl: videoUrl || ''
        };
        await fs.writeFile(SERVICIOS_FILE, JSON.stringify(serviciosData, null, 2));
        res.json(serviciosData[index]);
    } catch (e) {
        res.status(500).json({ error: 'Error al actualizar el servicio' });
    }
});

app.delete('/api/servicios/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    try {
        const id = req.params.id;
        let index = serviciosData.findIndex(s => s.id === id);
        if (index === -1) index = serviciosData.findIndex(s => s._id === id);
        if (index === -1) return res.status(404).json({ error: 'Servicio no encontrado' });
        serviciosData.splice(index, 1);
        serviciosData.forEach((s, i) => s.orden = i + 1);
        await fs.writeFile(SERVICIOS_FILE, JSON.stringify(serviciosData, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al eliminar el servicio' });
    }
});

// ============================================================
// HORARIOS
// ============================================================
app.get('/api/config/horarios', (req, res) => res.json(horariosConfig));

app.put('/api/config/horarios', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    try {
        const data = req.body;
        if (data.dias && Array.isArray(data.dias)) {
            horariosConfig.dias = data.dias;
            DIAS_VALIDOS = data.dias;
        }
        if (data.horarios && Array.isArray(data.horarios)) {
            horariosConfig.horarios = data.horarios;
            HORAS_VALIDAS = data.horarios.map(h => parseInt(h.split(':')[0]));
        }
        await fs.writeFile(HORARIOS_FILE, JSON.stringify(horariosConfig, null, 2));
        res.json({ success: true, horarios: horariosConfig });
    } catch(e) {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// ============================================================
// CONFIGURACIÓN REGISTRO - CON FALLBACK
// ============================================================

// Configuración por defecto
function getDefaultRegistroConfig() {
    return {
        hero: {
            titulo: 'El Arte del Masaje Profesional',
            subtitulo: 'Domina las técnicas que transforman cuerpos y vidas',
            boton: 'Comenzar Ahora'
        },
        beneficios: [
            { descripcion: 'Porcentaje de descuento en todos los servicios (configurable por admin)' },
            { descripcion: 'Reserva paquetes de 5, 10, o 15 días consecutivos con precio especial' },
            { descripcion: 'Cada año de membresía activa, recibe un masaje completamente gratis' },
            { descripcion: 'Comparte tu experiencia y ayuda a otros usuarios con tus comentarios' },
            { descripcion: 'Recibe alertas de nuevos servicios, técnicas y promociones especiales' },
            { descripcion: 'La inteligencia artificial te reconoce por tu nombre y te ofrece atención preferencial' }
        ],
        conceptos: [
            { titulo: 'Masaje Sueco', descripcion: 'Movimientos largos y fluidos para relajar los músculos superficiales.' },
            { titulo: 'Tejido Profundo', descripcion: 'Trabaja en capas musculares profundas. Ideal para contracturas crónicas.' },
            { titulo: 'Masaje Deportivo', descripcion: 'Pre-competencia, post-competencia y mantenimiento para atletas.' },
            { titulo: 'Beneficios Terapéuticos', descripcion: 'Reducción del cortisol, aumento de serotonina, mejora del sueño.' },
            { titulo: 'Contraindicaciones', descripcion: 'Trombosis, fiebre activa, lesiones agudas, piel infectada.' },
            { titulo: 'Técnicas Avanzadas + Descuentos', descripcion: 'Protocolos completos, secuencias y manejo de aceites para miembros premium.' }
        ],
        imagenWhatsApp: 'https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg'
    };
}

// Obtener configuración de registro desde archivo local
async function getRegistroConfigLocal() {
    try {
        if (fsSync.existsSync(REGISTRO_FILE)) {
            const fileContent = await fs.readFile(REGISTRO_FILE, 'utf8');
            const data = JSON.parse(fileContent);
            console.log('📖 Configuración de registro leída del archivo local');
            return data;
        }
    } catch (e) {
        console.warn('Error leyendo archivo local de registro:', e);
    }
    return getDefaultRegistroConfig();
}

// Obtener configuración de registro desde Supabase o fallback local
async function getRegistroConfig() {
    try {
        if (supabase) {
            console.log('📖 Intentando leer configuración de registro desde Supabase...');
            const { data, error } = await supabase
                .from('registro_config')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            
            if (error) {
                console.warn('⚠️ Error leyendo de Supabase:', error.message);
                return getRegistroConfigLocal();
            }
            
            if (data) {
                console.log('✅ Configuración de registro obtenida de Supabase');
                return data;
            }
        }
    } catch (e) {
        console.warn('⚠️ Error en getRegistroConfig:', e.message);
    }
    return getRegistroConfigLocal();
}

// Normalizar configuración de registro
function normalizeRegistroConfig(data) {
    if (!data) return getDefaultRegistroConfig();
    
    if (!data.hero) {
        data.hero = {
            titulo: 'El Arte del Masaje Profesional',
            subtitulo: 'Domina las técnicas que transforman cuerpos y vidas',
            boton: 'Comenzar Ahora'
        };
    }
    
    if (!data.beneficios || !Array.isArray(data.beneficios)) {
        data.beneficios = [];
    }
    data.beneficios = data.beneficios.map(b => {
        if (typeof b === 'string') return { descripcion: b };
        if (b && typeof b === 'object') {
            const desc = b.descripcion || b.texto || b.beneficio || b.desc || b.nombre || '';
            return { descripcion: desc };
        }
        return { descripcion: '' };
    });
    
    const defaultBeneficios = [
        'Porcentaje de descuento en todos los servicios (configurable por admin)',
        'Reserva paquetes de 5, 10, o 15 días consecutivos con precio especial',
        'Cada año de membresía activa, recibe un masaje completamente gratis',
        'Comparte tu experiencia y ayuda a otros usuarios con tus comentarios',
        'Recibe alertas de nuevos servicios, técnicas y promociones especiales',
        'La inteligencia artificial te reconoce por tu nombre y te ofrece atención preferencial'
    ];
    while (data.beneficios.length < 6) {
        data.beneficios.push({ descripcion: defaultBeneficios[data.beneficios.length] });
    }
    
    if (!data.conceptos || !Array.isArray(data.conceptos)) {
        data.conceptos = [];
    }
    data.conceptos = data.conceptos.map(c => {
        if (typeof c === 'string') return { titulo: 'Concepto', descripcion: c };
        if (c && typeof c === 'object') {
            return {
                titulo: c.titulo || c.nombre || 'Concepto',
                descripcion: c.descripcion || c.desc || c.texto || ''
            };
        }
        return { titulo: 'Concepto', descripcion: '' };
    });
    
    const defaultConceptos = [
        { titulo: 'Masaje Sueco', descripcion: 'Movimientos largos y fluidos para relajar los músculos superficiales.' },
        { titulo: 'Tejido Profundo', descripcion: 'Trabaja en capas musculares profundas. Ideal para contracturas crónicas.' },
        { titulo: 'Masaje Deportivo', descripcion: 'Pre-competencia, post-competencia y mantenimiento para atletas.' },
        { titulo: 'Beneficios Terapéuticos', descripcion: 'Reducción del cortisol, aumento de serotonina, mejora del sueño.' },
        { titulo: 'Contraindicaciones', descripcion: 'Trombosis, fiebre activa, lesiones agudas, piel infectada.' },
        { titulo: 'Técnicas Avanzadas + Descuentos', descripcion: 'Protocolos completos, secuencias y manejo de aceites para miembros premium.' }
    ];
    while (data.conceptos.length < 6) {
        data.conceptos.push(defaultConceptos[data.conceptos.length]);
    }
    
    if (!data.imagenWhatsApp) {
        data.imagenWhatsApp = 'https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg';
    }
    
    return data;
}

// Guardar configuración de registro en archivo local y Supabase (si está disponible)
async function saveRegistroConfig(data) {
    try {
        const normalizedData = normalizeRegistroConfig(data);
        
        // Guardar en archivo local siempre
        await fs.writeFile(REGISTRO_FILE, JSON.stringify(normalizedData, null, 2));
        console.log('✅ Configuración guardada en archivo local');
        
        // Intentar guardar en Supabase si está disponible
        if (supabase) {
            try {
                const { data: existingData, error: checkError } = await supabase
                    .from('registro_config')
                    .select('id')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single();
                
                let result;
                if (existingData && existingData.id) {
                    result = await supabase
                        .from('registro_config')
                        .update({
                            hero: normalizedData.hero,
                            beneficios: normalizedData.beneficios,
                            conceptos: normalizedData.conceptos,
                            imagenWhatsApp: normalizedData.imagenWhatsApp,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingData.id);
                } else {
                    result = await supabase
                        .from('registro_config')
                        .insert({
                            hero: normalizedData.hero,
                            beneficios: normalizedData.beneficios,
                            conceptos: normalizedData.conceptos,
                            imagenWhatsApp: normalizedData.imagenWhatsApp,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        });
                }
                
                if (result.error) {
                    console.warn('⚠️ Error guardando en Supabase:', result.error.message);
                } else {
                    console.log('✅ Configuración guardada en Supabase');
                }
            } catch (e) {
                console.warn('⚠️ Error en operación de Supabase:', e.message);
            }
        }
        
        return true;
    } catch (e) {
        console.error('❌ Error guardando configuración:', e);
        return false;
    }
}

// ============================================================
// RUTAS DE REGISTRO
// ============================================================

// GET - Obtener configuración de registro
app.get('/api/config/registro', async (req, res) => {
    try {
        const data = await getRegistroConfig();
        const normalized = normalizeRegistroConfig(data);
        console.log('📤 Enviando configuración de registro:', normalized.hero?.titulo);
        res.json(normalized);
    } catch (e) {
        console.error('Error en GET /api/config/registro:', e);
        res.json(getDefaultRegistroConfig());
    }
});

// PUT - Guardar configuración de registro
app.put('/api/config/registro', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) {
        return res.status(401).json({ error: 'Sesión expirada' });
    }
    
    try {
        const data = req.body;
        console.log('📝 Recibiendo configuración de registro para guardar:', data.hero?.titulo);
        
        const success = await saveRegistroConfig(data);
        
        if (success) {
            res.json({
                success: true,
                mensaje: 'Contenido de registro guardado correctamente',
                data: normalizeRegistroConfig(data)
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Error al guardar la configuración'
            });
        }
    } catch (e) {
        console.error('❌ Error guardando configuración de registro:', e);
        res.status(500).json({
            success: false,
            error: 'Error al guardar: ' + e.message
        });
    }
});

// ============================================================
// TURNOS
// ============================================================
app.post('/turnos', async (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || '0.0.0.0';
    const { nombre, telefono, massageType, dia, hora, codigoPais, ubicacion, tipoServicio, fecha } = req.body;
    if (estaBloqueado(ip)) return res.status(403).json({ error: 'Servicio cancelado' });
    const nombreValid = validarNombreCompleto(nombre);
    if (!nombreValid.valido) return res.status(400).json({ error: nombreValid.motivo });
    if (!telefono) return res.status(400).json({ error: 'El teléfono es obligatorio' });
    const telefonoValid = validarTelefonoCompleto(telefono);
    if (!telefonoValid.valido) return res.status(400).json({ error: telefonoValid.motivo });
    const telLimpio = telefonoValid.numero;
    let codPais = codigoPais || '53';
    if (!/^\d{1,3}$/.test(codPais)) codPais = '53';
    const turnos = JSON.parse(await fs.readFile(TURNOS_FILE, 'utf8'));
    let diaLower = dia?.toLowerCase();
    let horaNumerica = parseInt(hora);
    if (!diaLower || !DIAS_VALIDOS.includes(diaLower)) return res.status(400).json({ error: 'Día inválido' });
    if (isNaN(horaNumerica) || !HORAS_VALIDAS.includes(horaNumerica)) return res.status(400).json({ error: 'Hora no válida' });
    const ocupado = turnos.some(t => {
        if (t.fecha && fecha) return t.dia === diaLower && t.hora === horaNumerica && t.fecha === fecha;
        return t.dia === diaLower && t.hora === horaNumerica;
    });
    if (ocupado) return res.status(409).json({ error: 'Horario ocupado' });
    const codigoCancelacion = generarCodigoCancelacion();
    const ubicacionFinal = tipoServicio === 'domicilio' ? ubicacion : ubicacionSalonGlobal;
    const nuevoTurno = {
        id: generarId(),
        nombre: escapeHtml(nombre.trim()),
        dia: diaLower,
        fecha: fecha || new Date().toISOString().split('T')[0],
        hora: horaNumerica,
        massageType: massageType || 'Masaje',
        telefono: telLimpio,
        codigoPais: codPais,
        ubicacion: ubicacionFinal || 'Salón Serenity Spa',
        tipoServicio: tipoServicio || 'salon',
        confirmadoWhatsApp: false,
        fechaCreacion: new Date().toISOString(),
        ip: ip.replace('::ffff:', ''),
        codigoCancelacion: codigoCancelacion
    };
    turnos.push(nuevoTurno);
    await fs.writeFile(TURNOS_FILE, JSON.stringify(turnos, null, 2));
    res.status(201).json({ mensaje: 'Turno reservado', turno: nuevoTurno, codigoCancelacion: codigoCancelacion });
});

app.get('/turnos', async (req, res) => {
    try {
        const data = await fs.readFile(TURNOS_FILE, 'utf8');
        const turnos = JSON.parse(data);
        turnos.sort((a, b) => new Date(b.fechaCreacion) - new Date(a.fechaCreacion));
        res.json(turnos);
    } catch {
        res.json([]);
    }
});

app.delete('/turnos/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    try {
        const id = req.params.id;
        const turnos = JSON.parse(await fs.readFile(TURNOS_FILE, 'utf8'));
        const index = turnos.findIndex(t => t.id === id);
        if (index === -1) return res.status(404).json({ error: 'Turno no encontrado' });
        turnos.splice(index, 1);
        await fs.writeFile(TURNOS_FILE, JSON.stringify(turnos, null, 2));
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Error al eliminar turno' });
    }
});

// ============================================================
// AUTENTICACIÓN ADMIN
// ============================================================
const validTokens = new Map();

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    if (password === adminPassword) {
        const token = crypto.randomBytes(64).toString('hex');
        validTokens.set(token, Date.now() + 28800000);
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false });
    }
});

app.get('/api/verify', (req, res) => {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) return res.json({ valid: false });
    const token = h.substring(7);
    res.json({ valid: validTokens.has(token) && validTokens.get(token) > Date.now() });
});

// ============================================================
// SEGURIDAD
// ============================================================
app.get('/api/seguridad/bloqueos', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    const activos = [];
    for (const [ip, datos] of bloqueos) {
        activos.push({
            ip: ip,
            motivo: datos.motivo,
            tipoAtaque: datos.tipoAtaque,
            fecha: datos.fecha,
            tiempoRestante: Math.max(0, datos.hasta - Date.now()),
            tiempoRestanteFormateado: fmtT(Math.max(0, datos.hasta - Date.now())),
            permanente: datos.permanente || false,
            palabraOfensiva: datos.palabraOfensiva || null,
            conteoBloqueos: datos.conteoBloqueos || 0
        });
    }
    res.json({ activos: activos, historial: historialBloqueos.slice(0, 100), intentosFallidos: {} });
});

app.post('/api/seguridad/desbloquear/:ip', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    const ipDesbloquear = req.params.ip;
    if (bloqueos.has(ipDesbloquear)) {
        bloqueos.delete(ipDesbloquear);
        res.json({ ok: true, mensaje: `IP ${ipDesbloquear} desbloqueada` });
    } else {
        res.json({ ok: false, mensaje: 'IP no estaba bloqueada' });
    }
});

app.delete('/api/seguridad/bloqueos/:ip', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    const ipEliminar = req.params.ip;
    if (bloqueos.has(ipEliminar)) {
        bloqueos.delete(ipEliminar);
        res.json({ ok: true });
    } else {
        res.status(404).json({ error: 'IP no encontrada' });
    }
});

app.post('/api/seguridad/bloquear-usuario/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    try {
        const id = req.params.id;
        const turnos = JSON.parse(await fs.readFile(TURNOS_FILE, 'utf8'));
        const turno = turnos.find(t => t.id === id);
        if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });
        const ipUsuario = turno.ip || req.ip || '0.0.0.0';
        const ipLimpia = ipUsuario.replace('::ffff:', '');
        const conteo = obtenerConteoBloqueos(ipLimpia) + 1;
        const esPermanente = conteo >= 3;
        const motivo = `Cancelación manual - Usuario: ${turno.nombre} - ${conteo}ra vez`;
        bloquearIPConAcumulativo(ipLimpia, motivo, 'MANUAL_ADMIN', null, esPermanente);
        let duracionTexto = 'PERMANENTE';
        if (!esPermanente) duracionTexto = conteo === 1 ? '1 hora' : '2 horas';
        res.json({ success: true, ip: ipLimpia, conteo: conteo, permanente: esPermanente, duracionTexto: duracionTexto, motivo: motivo });
    } catch (e) {
        res.status(500).json({ error: 'Error al bloquear usuario' });
    }
});

// ============================================================
// PAÍSES
// ============================================================
app.get('/api/seguridad/paises', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    fs.readFile(PAISES_FILE, 'utf8')
        .then(data => res.json(JSON.parse(data)))
        .catch(() => res.json({ autorizados: [], bloqueados: [], modo: 'todos', ubicacionSalon: ubicacionSalonGlobal }));
});

app.put('/api/seguridad/paises', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    try {
        const data = JSON.parse(await fs.readFile(PAISES_FILE, 'utf8'));
        const { modo, ubicacionSalon } = req.body;
        if (modo) data.modo = modo;
        if (ubicacionSalon !== undefined) {
            data.ubicacionSalon = ubicacionSalon;
            ubicacionSalonGlobal = ubicacionSalon;
        }
        await fs.writeFile(PAISES_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Error al guardar' });
    }
});

app.post('/api/seguridad/paises/autorizar', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    const { codigo } = req.body;
    try {
        const data = JSON.parse(await fs.readFile(PAISES_FILE, 'utf8'));
        if (!data.autorizados.includes(codigo)) data.autorizados.push(codigo);
        data.bloqueados = data.bloqueados.filter(c => c !== codigo);
        await fs.writeFile(PAISES_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Error al autorizar' });
    }
});

app.post('/api/seguridad/paises/bloquear', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    const { codigo } = req.body;
    try {
        const data = JSON.parse(await fs.readFile(PAISES_FILE, 'utf8'));
        if (!data.bloqueados.includes(codigo)) data.bloqueados.push(codigo);
        data.autorizados = data.autorizados.filter(c => c !== codigo);
        await fs.writeFile(PAISES_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Error al bloquear' });
    }
});

app.delete('/api/seguridad/paises/:codigo', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    const { codigo } = req.params;
    try {
        const data = JSON.parse(await fs.readFile(PAISES_FILE, 'utf8'));
        data.autorizados = data.autorizados.filter(c => c !== codigo);
        data.bloqueados = data.bloqueados.filter(c => c !== codigo);
        await fs.writeFile(PAISES_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

app.get('/api/seguridad/paises/stats', async (req, res) => {
    try {
        const turnos = JSON.parse(await fs.readFile(TURNOS_FILE, 'utf8'));
        const stats = {};
        for (const t of turnos) {
            const codigo = t.codigoPais || '53';
            if (!stats[codigo]) stats[codigo] = 0;
            stats[codigo]++;
        }
        const result = Object.entries(stats).map(([codigo, reservas]) => ({ codigo, reservas }));
        res.json(result);
    } catch {
        res.json([]);
    }
});

// ============================================================
// WHATSAPP
// ============================================================
app.post('/api/enviar-whatsapp/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    try {
        const id = req.params.id;
        const turnos = JSON.parse(await fs.readFile(TURNOS_FILE, 'utf8'));
        const turno = turnos.find(t => t.id === id);
        if (!turno) return res.status(404).json({ error: 'Turno no encontrado' });
        let imagenWhatsApp = 'https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg';
        if (turno.massageType) {
            const servicio = serviciosData.find(s => s.nombre === turno.massageType);
            if (servicio && servicio.imagenWhatsApp) imagenWhatsApp = servicio.imagenWhatsApp;
        }
        let numero = turno.telefono;
        if (turno.codigoPais) numero = `${turno.codigoPais}${numero}`;
        const mensaje = `🌿 *SERENITY SPA*\n\nHola *${turno.nombre}*, ¡Gracias! ✨\n\n✅ *RESERVA CONFIRMADA*\n\n📅 *Día:* ${turno.dia}\n📆 *Fecha:* ${turno.fecha || turno.dia}\n\n⏰ *Hora:* ${turno.hora}:00 hs\n💆‍♂️ *Masaje:* ${turno.massageType || 'Masaje'}\n📍 ${turno.ubicacion || 'Salón Serenity Spa'}\n\n🌸 Te esperamos.\n⏱️ Cancelá con 4hs de anticipación.\n\n🖼️ *Imagen:* ${imagenWhatsApp}\n\n*Equipo Serenity Spa*`;
        res.json({ success: true, numero: numero, mensaje: mensaje });
    } catch (e) {
        console.error('Error preparando WhatsApp:', e);
        res.status(500).json({ error: 'Error al preparar el mensaje' });
    }
});

// ============================================================
// PALABRAS BANEADAS
// ============================================================
app.get('/api/palabras-baneadas', async (req, res) => {
    try {
        if (fsSync.existsSync(PALABRAS_BANEADAS_FILE)) {
            const data = JSON.parse(await fs.readFile(PALABRAS_BANEADAS_FILE, 'utf8'));
            res.json(data);
        } else {
            res.json({ palabras: palabrasBaneadas });
        }
    } catch(e) {
        res.json({ palabras: palabrasBaneadas });
    }
});

app.post('/api/palabras-baneadas', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    try {
        const { palabra, accion } = req.body;
        if (accion === 'agregar') {
            if (!palabrasBaneadas.includes(palabra)) {
                palabrasBaneadas.push(palabra);
                await fs.writeFile(PALABRAS_BANEADAS_FILE, JSON.stringify({ palabras: palabrasBaneadas }, null, 2));
            }
        } else if (accion === 'eliminar') {
            palabrasBaneadas = palabrasBaneadas.filter(p => p !== palabra);
            await fs.writeFile(PALABRAS_BANEADAS_FILE, JSON.stringify({ palabras: palabrasBaneadas }, null, 2));
        }
        res.json({ success: true, palabras: palabrasBaneadas });
    } catch(e) {
        res.status(500).json({ error: 'Error al modificar palabras baneadas' });
    }
});

// ============================================================
// CONFIGURACIÓN FRONTEND
// ============================================================
app.get('/api/config-frontend', (req, res) => {
    res.json({
        supabaseUrl: process.env.SUPABASE_URL || '',
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
        ubicacionSalon: ubicacionSalonGlobal
    });
});

// ============================================================
// IA (API SIMULADA)
// ============================================================
let iaPersonalidad = {
    nombre: 'SpaBot',
    tono: 'cálido y profesional',
    estilo: 'Hablar en español neutro, ser amable y empático',
    reglas: ['NUNCA inventar información', 'SIEMPRE ofrecer reservar turnos', 'Ser cortés y profesional']
};

app.get('/api/ia/personalidad', (req, res) => {
    res.json(iaPersonalidad);
});

app.put('/api/ia/personalidad', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No autorizado' });
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) return res.status(401).json({ error: 'Sesión expirada' });
    try {
        iaPersonalidad = req.body;
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Error al guardar personalidad IA' });
    }
});

app.post('/api/ia/recargar', (req, res) => {
    res.json({ success: true, items: 0 });
});

// ============================================================
// INICIO DEL SERVIDOR
// ============================================================
const server = app.listen(PORT, '0.0.0.0', async () => {
    await initAllFiles();
    console.log(`🌿 Serenity Spa iniciado en puerto ${PORT}`);
    console.log(`📂 Directorio base: ${BASE_DIR}`);
    console.log(`📂 Directorio de datos: ${DATA_DIR}`);
    console.log(`📋 Servicios disponibles: ${serviciosData.length}`);
    console.log(`🔒 Bloqueos activos: ${bloqueos.size}`);
    console.log(`📍 Ubicación del salón: ${ubicacionSalonGlobal}`);
    console.log(`🔗 Supabase: ${supabase ? '✅ Conectado' : '❌ No disponible (usando archivos locales)'}`);
});

const wss = new WebSocket.Server({ server, path: '/ws-voice' });
let voiceClients = new Map();

wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress || 'desconocida';
    if (estaBloqueado(ip)) {
        ws.close(1008, 'IP bloqueada');
        return;
    }
    const cid = generarId();
    voiceClients.set(cid, { estado: 'inicial', datos: {} });
    ws.on('message', async (data) => {
        try {
            const m = JSON.parse(data);
            if (m.tipo === 'transcripcion') {
                ws.send(JSON.stringify({ tipo: 'respuesta', texto: `Procesando tu solicitud...` }));
            }
        } catch(e) {
            console.error('Error en WebSocket:', e);
        }
    });
    ws.on('close', () => voiceClients.delete(cid));
});