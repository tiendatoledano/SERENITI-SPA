const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 10000;
const BASE_DIR = __dirname;

// Archivos de datos
const TURNOS_FILE = path.join(BASE_DIR, 'turnos.json');
const SERVICIOS_FILE = path.join(BASE_DIR, 'servicios.json');
const CONFIG_FILE = path.join(BASE_DIR, 'config.json');
const PAISES_FILE = path.join(BASE_DIR, 'paises.json');
const HORARIOS_FILE = path.join(BASE_DIR, 'horarios.json');
const PALABRAS_BANEADAS_FILE = path.join(BASE_DIR, 'palabras-baneadas.json');
const REGISTRO_CONFIG_FILE = path.join(BASE_DIR, 'registro-config.json');
const USUARIOS_FILE = path.join(BASE_DIR, 'registro-usuarios.json');
const CODIGOS_FILE = path.join(BASE_DIR, 'codigos-verificacion.json');
const TESTIMONIOS_FILE = path.join(BASE_DIR, 'testimonios.json');

// ============================================================
// IMPORTAR SISTEMA DE SEGURIDAD (AQUÍ ESTÁ LA LÍNEA)
// ============================================================






// Configuración SMTP CORREGIDA para evitar que se cuelgue
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, // OBLIGATORIO poner true para el puerto 465
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    // NUEVAS LÍNEAS PARA EVITAR QUE SE CARGUE PARA SIEMPRE
    connectionTimeout: 10000, // 10 segundos para conectar
    greetingTimeout: 10000,   // 10 segundos para saludo
    socketTimeout: 15000,     // 15 segundos para enviar
    debug: true,              // Esto mostrará los errores en la consola de Render
    logger: true              // Para que puedas ver qué está pasando
});



app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(BASE_DIR));

// ============================================================
// MIDDLEWARE ANTI-CACHE
// ============================================================
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// ============================================================
// VARIABLES GLOBALES
// ============================================================
let serviciosData = [];
let configData = {};
let horariosConfig = {
    dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
    horarios: ['12:00', '16:00', '20:00']
};
let palabrasBaneadas = [];
let ubicacionSalonGlobal = 'Salón Serenity Spa';
const validTokens = new Map();
let usuariosRegistrados = [];
let codigosVerificacion = {};

// ============================================================
// FUNCIONES UTILITARIAS
// ============================================================
function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2) + crypto.randomBytes(4).toString('hex');
}

function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function contienePalabraProhibida(texto) {
    if (!texto || typeof texto !== 'string') return false;
    const textoLower = texto.toLowerCase().trim();
    for (const palabra of palabrasBaneadas) {
        if (textoLower.includes(palabra.toLowerCase())) {
            return true;
        }
    }
    return false;
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

// ============================================================
// FUNCIONES DE INICIALIZACIÓN DE ARCHIVOS
// ============================================================
async function initAllFiles() {
    console.log('🔧 Inicializando archivos en:', BASE_DIR);

    // REGISTRO-CONFIG.json
    if (!fsSync.existsSync(REGISTRO_CONFIG_FILE)) {
        const registroDefault = {
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
        await fs.writeFile(REGISTRO_CONFIG_FILE, JSON.stringify(registroDefault, null, 2));
        console.log('✅ registro-config.json creado');
    }

    // SERVICIOS.json
    if (!fsSync.existsSync(SERVICIOS_FILE)) {
        const serviciosDefault = [
            { id: generarId(), nombre: "Masaje Relajante", precio: "$45", descripcion: "Movimientos suaves para liberar el estrés.", beneficios: ["60 Minutos"], efectos: ["Relajación profunda"], imagenWeb: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800", imagenWhatsApp: "https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg", orden: 1 },
            { id: generarId(), nombre: "Masaje Corporal", precio: "$65", descripcion: "Tratamiento completo para una relajación profunda.", beneficios: ["90 Minutos"], efectos: ["Activación linfática"], imagenWeb: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800", imagenWhatsApp: "https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg", orden: 2 },
            { id: generarId(), nombre: "Masaje Facial", precio: "$40", descripcion: "Rejuvenece la piel y alivia la tensión facial.", beneficios: ["45 Minutos"], efectos: ["Estimula colágeno"], imagenWeb: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=800", imagenWhatsApp: "https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg", orden: 3 }
        ];
        await fs.writeFile(SERVICIOS_FILE, JSON.stringify(serviciosDefault, null, 2));
        console.log('✅ servicios.json creado');
    }
    try {
        const data = await fs.readFile(SERVICIOS_FILE, 'utf8');
        serviciosData = JSON.parse(data);
        console.log(`✅ Servicios cargados: ${serviciosData.length}`);
    } catch(e) {
        console.error('Error cargando servicios:', e);
        serviciosData = [];
    }

    // CONFIG.json
    if (!fsSync.existsSync(CONFIG_FILE)) {
        const defaultConfig = {
            hero: {
                titulo: 'Renueva tu Energía',
                subtitulo: 'Experiencias de bienestar',
                imagenFondo: '',
                botonTexto: 'Reserva tu Turno'
            },
            serviciosSection: {
                etiqueta: 'Nuestros Servicios',
                titulo: 'Elige tu Masaje Ideal',
                descripcion: 'Turnos disponibles según horarios'
            },
            contactoSection: {
                titulo: 'Asistente de Reservas',
                descripcion: 'Habla con nuestro asistente'
            },
            shareSection: {
                titulo: 'Comparte Serenity Spa'
            }
        };
        await fs.writeFile(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
        console.log('✅ config.json creado');
    }
    try {
        const data = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
        configData = data;
        console.log('✅ config.json cargado');
    } catch(e) {
        console.error('Error cargando config.json:', e);
    }

    // TURNOS.json
    if (!fsSync.existsSync(TURNOS_FILE)) {
        await fs.writeFile(TURNOS_FILE, JSON.stringify([], null, 2));
        console.log('✅ turnos.json creado');
    }

    // HORARIOS.json
    if (!fsSync.existsSync(HORARIOS_FILE)) {
        await fs.writeFile(HORARIOS_FILE, JSON.stringify(horariosConfig, null, 2));
        console.log('✅ horarios.json creado');
    }

    // PAISES.json
    if (!fsSync.existsSync(PAISES_FILE)) {
        await fs.writeFile(PAISES_FILE, JSON.stringify({ autorizados: [], bloqueados: [], modo: 'todos', ubicacionSalon: 'Salón Serenity Spa' }, null, 2));
        console.log('✅ paises.json creado');
    }
    try {
        const paisesData = JSON.parse(await fs.readFile(PAISES_FILE, 'utf8'));
        if (paisesData.ubicacionSalon) {
            ubicacionSalonGlobal = paisesData.ubicacionSalon;
        }
    } catch(e) {
        console.warn('Error cargando ubicación:', e);
    }

    // PALABRAS BANEADAS
    if (!fsSync.existsSync(PALABRAS_BANEADAS_FILE)) {
        const defaultPalabras = [
            'puta', 'puto', 'puta madre', 'putamadre', 'hijodeputa', 'hijo de puta',
            'mierda', 'coño', 'carajo', 'verga', 'chinga', 'chingue', 'chingada',
            'fuck', 'shit', 'bitch', 'asshole', 'motherfucker', 'cunt',
            'idiota', 'estupido', 'imbecil', 'tarado', 'estúpido', 'imbécil',
            'pendejo', 'cabron', 'cabrón', 'malparido', 'gonorrea', 'carechimba'
        ];
        await fs.writeFile(PALABRAS_BANEADAS_FILE, JSON.stringify({ palabras: defaultPalabras }, null, 2));
        console.log('✅ palabras-baneadas.json creado');
    }
    try {
        const data = JSON.parse(await fs.readFile(PALABRAS_BANEADAS_FILE, 'utf8'));
        palabrasBaneadas = data.palabras || [];
        console.log(`✅ Palabras baneadas cargadas: ${palabrasBaneadas.length}`);
    } catch(e) {
        console.error('Error cargando palabras baneadas:', e);
    }

    // USUARIOS_REGISTRADOS
    if (!fsSync.existsSync(USUARIOS_FILE)) {
        await fs.writeFile(USUARIOS_FILE, JSON.stringify([], null, 2));
        console.log('✅ registro-usuarios.json creado');
    }
    try {
        const data = await fs.readFile(USUARIOS_FILE, 'utf8');
        usuariosRegistrados = JSON.parse(data);
        console.log(`✅ Usuarios cargados: ${usuariosRegistrados.length}`);
    } catch(e) {
        console.error('Error cargando usuarios:', e);
        usuariosRegistrados = [];
    }

    // CODIGOS_VERIFICACION
    if (!fsSync.existsSync(CODIGOS_FILE)) {
        await fs.writeFile(CODIGOS_FILE, JSON.stringify({}, null, 2));
        console.log('✅ codigos-verificacion.json creado');
    }

    // TESTIMONIOS
    if (!fsSync.existsSync(TESTIMONIOS_FILE)) {
        await fs.writeFile(TESTIMONIOS_FILE, JSON.stringify([], null, 2));
        console.log('✅ testimonios.json creado');
    }

    console.log('✅ Todos los archivos inicializados correctamente');
}

// ============================================================
// MIDDLEWARE DE AUTENTICACIÓN ADMIN
// ============================================================
function verifyAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    const token = authHeader.substring(7);
    if (!validTokens.has(token) || validTokens.get(token) < Date.now()) {
        return res.status(401).json({ error: 'Sesión expirada' });
    }
    next();
}

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
app.get('/asistente', (req, res) => res.sendFile(path.join(BASE_DIR, 'asistente.html')));
app.get('/terminos', (req, res) => res.sendFile(path.join(BASE_DIR, 'terminos.html')));

// ============================================================
// AUTENTICACIÓN ADMIN
// ============================================================
app.post('/api/login', async (req, res) => {
    const ip = seguridad.getClientIP(req);
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (password === adminPassword) {
        // Login exitoso, resetear intentos
        seguridad.intentosLogin.delete(ip);
        const token = crypto.randomBytes(64).toString('hex');
        validTokens.set(token, Date.now() + 28800000);
        res.json({ success: true, token });
    } else {
        // Login fallido, incrementar intentos
        const intentos = seguridad.incrementarIntentosLogin(ip);
        
        // Si supera los intentos, bloquear IP
        if (intentos > 5) {
            await seguridad.registrarAtaque(ip, 'BRUTE_FORCE', `Múltiples intentos de login fallidos (${intentos})`, null, '/api/login');
            const resultado = await seguridad.bloquearIP(ip, 'Múltiples intentos de login fallidos (fuerza bruta)', 'BRUTE_FORCE', null, '/api/login');
            return res.status(403).json({ 
                error: '🚫 Demasiados intentos de login. IP bloqueada por seguridad.',
                codigo: 'SEC-403-BRUTE',
                ip: ip,
                bloqueado: true,
                tiempo: resultado.duracionTexto
            });
        }
        
        res.status(401).json({ 
            success: false, 
            intentosRestantes: 5 - intentos,
            mensaje: `Contraseña incorrecta. Te quedan ${5 - intentos} intentos.`
        });
    }
});

// ============================================================
// VERIFICACIÓN DE TOKEN ADMIN
// ============================================================
app.get('/api/verify', (req, res) => {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) return res.json({ valid: false });
    const token = h.substring(7);
    res.json({ valid: validTokens.has(token) && validTokens.get(token) > Date.now() });
});

// ============================================================
// CONFIGURACIÓN PRINCIPAL
// ============================================================
app.get('/api/config', (req, res) => {
    res.json(configData);
});

app.put('/api/config', verifyAuth, async (req, res) => {
    try {
        const data = req.body;
        configData = {
            hero: {
                titulo: data.hero?.titulo || configData.hero?.titulo || 'Renueva tu Energía',
                subtitulo: data.hero?.subtitulo || configData.hero?.subtitulo || 'Experiencias de bienestar',
                imagenFondo: data.hero?.imagenFondo || configData.hero?.imagenFondo || '',
                botonTexto: data.hero?.botonTexto || configData.hero?.botonTexto || 'Reserva tu Turno'
            },
            serviciosSection: {
                etiqueta: data.serviciosSection?.etiqueta || configData.serviciosSection?.etiqueta || 'Nuestros Servicios',
                titulo: data.serviciosSection?.titulo || configData.serviciosSection?.titulo || 'Elige tu Masaje Ideal',
                descripcion: data.serviciosSection?.descripcion || configData.serviciosSection?.descripcion || 'Turnos disponibles según horarios'
            },
            contactoSection: {
                titulo: data.contactoSection?.titulo || configData.contactoSection?.titulo || 'Asistente de Reservas',
                descripcion: data.contactoSection?.descripcion || configData.contactoSection?.descripcion || 'Habla con nuestro asistente'
            },
            shareSection: {
                titulo: data.shareSection?.titulo || configData.shareSection?.titulo || 'Comparte Serenity Spa'
            }
        };
        await fs.writeFile(CONFIG_FILE, JSON.stringify(configData, null, 2));
        console.log('✅ Configuración principal guardada');
        res.json({ success: true, data: configData });
    } catch(e) {
        console.error('Error guardando configuración:', e);
        res.status(500).json({ error: 'Error al guardar la configuración' });
    }
});

// ============================================================
// SUBIR IMAGEN HERO
// ============================================================
app.post('/api/upload-hero', verifyAuth, async (req, res) => {
    try {
        const { base64 } = req.body;
        if (!base64) return res.status(400).json({ error: 'No se proporcionó imagen' });
        const matches = base64.match(/^data:image\/(\w+);base64,(.+)$/);
        if (!matches) return res.status(400).json({ error: 'Formato de imagen no válido' });
        const ext = matches[1];
        const data = Buffer.from(matches[2], 'base64');
        const filename = `hero-${Date.now()}.${ext}`;
        const uploadDir = path.join(BASE_DIR, 'uploads');
        if (!fsSync.existsSync(uploadDir)) {
            fsSync.mkdirSync(uploadDir, { recursive: true });
        }
        const filepath = path.join(uploadDir, filename);
        await fs.writeFile(filepath, data);
        const url = `/uploads/${filename}`;
        configData.hero.imagenFondo = url;
        await fs.writeFile(CONFIG_FILE, JSON.stringify(configData, null, 2));
        res.json({ success: true, url });
    } catch(e) {
        console.error('Error subiendo imagen:', e);
        res.status(500).json({ error: 'Error al subir la imagen' });
    }
});

app.use('/uploads', express.static(path.join(BASE_DIR, 'uploads')));

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

app.post('/api/servicios', verifyAuth, async (req, res) => {
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
        console.error('Error al crear el servicio:', e);
        res.status(500).json({ error: 'Error al crear el servicio' });
    }
});

app.put('/api/servicios/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { nombre, precio, descripcion, beneficios, efectos, imagenWeb, imagenWhatsApp, videoUrl } = req.body;
        let index = serviciosData.findIndex(s => s.id === id);
        if (index === -1) return res.status(404).json({ error: 'Servicio no encontrado' });
        serviciosData[index] = {
            ...serviciosData[index],
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
        console.error('Error al actualizar el servicio:', e);
        res.status(500).json({ error: 'Error al actualizar el servicio' });
    }
});

app.delete('/api/servicios/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        let index = serviciosData.findIndex(s => s.id === id);
        if (index === -1) return res.status(404).json({ error: 'Servicio no encontrado' });
        serviciosData.splice(index, 1);
        serviciosData.forEach((s, i) => s.orden = i + 1);
        await fs.writeFile(SERVICIOS_FILE, JSON.stringify(serviciosData, null, 2));
        res.json({ success: true });
    } catch (e) {
        console.error('Error al eliminar el servicio:', e);
        res.status(500).json({ error: 'Error al eliminar el servicio' });
    }
});

// ============================================================
// HORARIOS
// ============================================================
app.get('/api/config/horarios', (req, res) => res.json(horariosConfig));

app.put('/api/config/horarios', verifyAuth, async (req, res) => {
    try {
        const data = req.body;
        if (data.dias && Array.isArray(data.dias)) {
            horariosConfig.dias = data.dias;
        }
        if (data.horarios && Array.isArray(data.horarios)) {
            horariosConfig.horarios = data.horarios;
        }
        await fs.writeFile(HORARIOS_FILE, JSON.stringify(horariosConfig, null, 2));
        res.json({ success: true, horarios: horariosConfig });
    } catch(e) {
        console.error('Error al guardar horarios:', e);
        res.status(500).json({ error: 'Error al guardar' });
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

app.post('/api/palabras-baneadas', verifyAuth, async (req, res) => {
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
        console.error('Error al modificar palabras baneadas:', e);
        res.status(500).json({ error: 'Error al modificar palabras baneadas' });
    }
});

// ============================================================
// PAÍSES
// ============================================================
app.get('/api/seguridad/paises', (req, res) => {
    fs.readFile(PAISES_FILE, 'utf8')
        .then(data => res.json(JSON.parse(data)))
        .catch(() => res.json({ autorizados: [], bloqueados: [], modo: 'todos', ubicacionSalon: ubicacionSalonGlobal }));
});

app.put('/api/seguridad/paises', verifyAuth, async (req, res) => {
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
        console.error('Error al guardar países:', e);
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// ============================================================
// CONFIGURACIÓN REGISTRO (ACADEMIA)
// ============================================================
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

function normalizeRegistroConfig(data) {
    if (!data) return getDefaultRegistroConfig();
    if (!data.hero) {
        data.hero = { titulo: 'El Arte del Masaje Profesional', subtitulo: 'Domina las técnicas que transforman cuerpos y vidas', boton: 'Comenzar Ahora' };
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

app.get('/api/config/registro', async (req, res) => {
    console.log('📤 GET /api/config/registro - Solicitado');
    try {
        let data;
        if (fsSync.existsSync(REGISTRO_CONFIG_FILE)) {
            const fileContent = await fs.readFile(REGISTRO_CONFIG_FILE, 'utf8');
            data = JSON.parse(fileContent);
        } else {
            data = getDefaultRegistroConfig();
        }
        const normalized = normalizeRegistroConfig(data);
        res.json(normalized);
    } catch (e) {
        console.error('❌ Error en GET /api/config/registro:', e);
        res.json(getDefaultRegistroConfig());
    }
});

app.put('/api/config/registro', verifyAuth, async (req, res) => {
    console.log('📥 PUT /api/config/registro - Solicitud recibida');
    try {
        const data = req.body;
        if (!data || typeof data !== 'object') {
            return res.status(400).json({ success: false, error: 'Datos inválidos' });
        }
        const normalizedData = normalizeRegistroConfig(data);
        await fs.writeFile(REGISTRO_CONFIG_FILE, JSON.stringify(normalizedData, null, 2));
        res.json({
            success: true,
            mensaje: 'Contenido de registro guardado correctamente',
            data: normalizedData
        });
    } catch (e) {
        console.error('❌ Error guardando configuración de registro:', e);
        res.status(500).json({ success: false, error: 'Error al guardar: ' + e.message });
    }
});

// ============================================================
// TURNOS
// ============================================================
app.post('/turnos', async (req, res) => {
    const { nombre, telefono, massageType, dia, hora, codigoPais, ubicacion, tipoServicio, fecha } = req.body;
    if (!nombre || !telefono || !massageType || !dia || hora === undefined) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }
    const turnos = JSON.parse(await fs.readFile(TURNOS_FILE, 'utf8'));
    const diaLower = dia.toLowerCase();
    const horaNumerica = parseInt(hora);
    const ocupado = turnos.some(t => {
        if (t.fecha && fecha) {
            return t.dia === diaLower && t.hora === horaNumerica && t.fecha === fecha;
        }
        return t.dia === diaLower && t.hora === horaNumerica;
    });
    if (ocupado) {
        return res.status(409).json({ error: 'Horario ocupado' });
    }
    const codigoCancelacion = Math.random().toString(36).substring(2, 8).toUpperCase();
    const ubicacionFinal = tipoServicio === 'domicilio' ? ubicacion : ubicacionSalonGlobal;
    const nuevoTurno = {
        id: generarId(),
        nombre: escapeHtml(nombre.trim()),
        dia: diaLower,
        fecha: fecha || new Date().toISOString().split('T')[0],
        hora: horaNumerica,
        massageType: massageType,
        telefono: telefono.replace(/\D/g, ''),
        codigoPais: codigoPais || '53',
        ubicacion: ubicacionFinal || 'Salón Serenity Spa',
        tipoServicio: tipoServicio || 'salon',
        confirmadoWhatsApp: false,
        fechaCreacion: new Date().toISOString(),
        codigoCancelacion: codigoCancelacion
    };
    turnos.push(nuevoTurno);
    await fs.writeFile(TURNOS_FILE, JSON.stringify(turnos, null, 2));
    res.status(201).json({ 
        mensaje: 'Turno reservado', 
        turno: nuevoTurno,
        codigoCancelacion: codigoCancelacion
    });
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

app.delete('/turnos/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const turnos = JSON.parse(await fs.readFile(TURNOS_FILE, 'utf8'));
        const index = turnos.findIndex(t => t.id === id);
        if (index === -1) return res.status(404).json({ error: 'Turno no encontrado' });
        turnos.splice(index, 1);
        await fs.writeFile(TURNOS_FILE, JSON.stringify(turnos, null, 2));
        res.json({ success: true });
    } catch(e) {
        console.error('Error al eliminar turno:', e);
        res.status(500).json({ error: 'Error al eliminar turno' });
    }
});

// ============================================================
// WHATSAPP
// ============================================================
app.post('/api/enviar-whatsapp/:id', verifyAuth, async (req, res) => {
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
        const numero = `${turno.codigoPais}${turno.telefono}`;
        const mensaje = `🌿 *SERENITY SPA*\n\nHola *${turno.nombre}*, ¡Gracias! ✨\n\n✅ *RESERVA CONFIRMADA*\n\n📅 *Día:* ${turno.dia}\n📆 *Fecha:* ${turno.fecha || turno.dia}\n\n⏰ *Hora:* ${turno.hora}:00 hs\n💆‍♂️ *Masaje:* ${turno.massageType || 'Masaje'}\n📍 ${turno.ubicacion || 'Salón Serenity Spa'}\n\n🌸 Te esperamos.\n⏱️ Cancelá con 4hs de anticipación.\n\n🖼️ *Imagen:* ${imagenWhatsApp}\n\n*Equipo Serenity Spa*`;
        res.json({ success: true, numero: numero, mensaje: mensaje });
    } catch (e) {
        console.error('Error preparando WhatsApp:', e);
        res.status(500).json({ error: 'Error al preparar el mensaje' });
    }
});

// ============================================================
// CONFIGURACIÓN FRONTEND
// ============================================================
app.get('/api/config-frontend', (req, res) => {
    res.json({
        supabaseUrl: '',
        supabaseAnonKey: '',
        ubicacionSalon: ubicacionSalonGlobal
    });
});

// ============================================================
// RUTAS DE REGISTRO Y VERIFICACIÓN DE USUARIOS
// ============================================================
app.post('/api/registro/solicitar-codigo', async (req, res) => {
    try {
        const { nombre, email } = req.body;
        if (!nombre || !email) {
            return res.status(400).json({ error: 'Nombre y email son requeridos' });
        }
        if (contienePalabraProhibida(nombre)) {
            return res.status(400).json({ error: 'El nombre contiene palabras inapropiadas.' });
        }
        if (contienePalabraProhibida(email)) {
            return res.status(400).json({ error: 'El email contiene palabras inapropiadas.' });
        }
        if (!email.includes('@') || !email.includes('.')) {
            return res.status(400).json({ error: 'El email no parece válido.' });
        }
        const usuarioExistente = usuariosRegistrados.find(u => u.email === email);
        if (usuarioExistente && usuarioExistente.verificado) {
            return res.status(400).json({ error: 'Este email ya está registrado y verificado.' });
        }
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const expiracion = Date.now() + 3 * 60 * 1000; // 3 minutos
        const codigosData = await fs.readFile(CODIGOS_FILE, 'utf8');
        const codigos = JSON.parse(codigosData);
        codigos[email] = {
            codigo: codigo,
            expiracion: expiracion,
            intentos: 0,
            nombre: nombre
        };
        await fs.writeFile(CODIGOS_FILE, JSON.stringify(codigos, null, 2));
        const mailOptions = {
            from: `"Serenity Spa" <${process.env.SMTP_USER}>`,
            to: email,
            subject: 'Código de verificación - Serenity Spa',
            text: `Hola ${nombre},\n\nTu código de verificación para Serenity Spa es:\n\n${codigo}\n\nEste código expirará en 3 minutos.\n\nSi no solicitaste este código, ignora este mensaje.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                    <h2 style="color: #C9A961;">Serenity Spa</h2>
                    <p>Hola <strong>${nombre}</strong>,</p>
                    <p>Has solicitado registrarte en nuestra plataforma. Tu código de verificación es:</p>
                    <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; border-radius: 8px; margin: 20px 0;">
                        ${codigo}
                    </div>
                    <p>Este código expirará en <strong>3 minutos</strong>. Por favor, ingrésalo en la página de registro para completar el proceso.</p>
                    <p style="color: #888; font-size: 12px; margin-top: 20px;">Si no solicitaste este código, ignora este mensaje.</p>
                </div>
            `
        };
        try {
            await transporter.sendMail(mailOptions);
            res.json({ success: true, message: 'Código enviado a tu correo electrónico.' });
        } catch (error) {
            console.error('Error enviando correo:', error);
            res.status(500).json({ error: 'Error al enviar el correo de verificación. Por favor, intenta de nuevo.' });
        }
    } catch (error) {
        console.error('Error en solicitar-codigo:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.post('/api/registro/verificar-codigo', async (req, res) => {
    try {
        const { email, codigo } = req.body;
        if (!email || !codigo) {
            return res.status(400).json({ error: 'Email y código son requeridos' });
        }
        const codigosData = await fs.readFile(CODIGOS_FILE, 'utf8');
        const codigos = JSON.parse(codigosData);
        const registro = codigos[email];
        if (!registro) {
            return res.status(400).json({ error: 'No hay un código pendiente para este email.' });
        }
        if (Date.now() > registro.expiracion) {
            delete codigos[email];
            await fs.writeFile(CODIGOS_FILE, JSON.stringify(codigos, null, 2));
            return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
        }
        if (registro.intentos >= 3) {
            delete codigos[email];
            await fs.writeFile(CODIGOS_FILE, JSON.stringify(codigos, null, 2));
            return res.status(400).json({ error: 'Demasiados intentos. Solicita un nuevo código.' });
        }
        if (registro.codigo !== codigo) {
            registro.intentos++;
            await fs.writeFile(CODIGOS_FILE, JSON.stringify(codigos, null, 2));
            return res.status(400).json({ error: `Código incorrecto. Te quedan ${3 - registro.intentos} intentos.` });
        }
        const nuevoUsuario = {
            id: generarId(),
            nombre: registro.nombre,
            email: email,
            telefono: '',
            verificado: true,
            bloqueado: false,
            motivoBloqueo: null,
            fechaRegistro: new Date().toISOString(),
            fechaVerificacion: new Date().toISOString()
        };
        usuariosRegistrados.push(nuevoUsuario);
        await fs.writeFile(USUARIOS_FILE, JSON.stringify(usuariosRegistrados, null, 2));
        delete codigos[email];
        await fs.writeFile(CODIGOS_FILE, JSON.stringify(codigos, null, 2));
        const token = crypto.randomBytes(64).toString('hex');
        validTokens.set(token, Date.now() + 28800000);
        res.json({
            success: true,
            message: 'Registro completado exitosamente.',
            token: token,
            usuario: {
                id: nuevoUsuario.id,
                nombre: nuevoUsuario.nombre,
                email: nuevoUsuario.email,
                verificado: nuevoUsuario.verificado
            }
        });
    } catch (error) {
        console.error('Error en verificar-codigo:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ============================================================
// RUTAS DE VERIFICACIÓN DE SESIÓN DE USUARIO
// ============================================================
app.get('/api/verify/user', (req, res) => {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) return res.json({ valid: false });
    const token = h.substring(7);
    const valid = validTokens.has(token) && validTokens.get(token) > Date.now();
    res.json({ valid: valid });
});

// ============================================================
// RUTAS DE ADMIN PARA USUARIOS (GESTIÓN)
// ============================================================
app.get('/api/usuarios', verifyAuth, async (req, res) => {
    try {
        const data = await fs.readFile(USUARIOS_FILE, 'utf8');
        const usuarios = JSON.parse(data);
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: 'Error al cargar usuarios' });
    }
});

app.delete('/api/usuarios/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        let usuarios = JSON.parse(await fs.readFile(USUARIOS_FILE, 'utf8'));
        const index = usuarios.findIndex(u => u.id === id);
        if (index === -1) return res.status(404).json({ error: 'Usuario no encontrado' });
        usuarios.splice(index, 1);
        await fs.writeFile(USUARIOS_FILE, JSON.stringify(usuarios, null, 2));
        res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

app.put('/api/usuarios/:id/bloquear', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { motivo } = req.body;
        let usuarios = JSON.parse(await fs.readFile(USUARIOS_FILE, 'utf8'));
        const usuario = usuarios.find(u => u.id === id);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
        usuario.bloqueado = !usuario.bloqueado;
        usuario.motivoBloqueo = usuario.bloqueado ? (motivo || 'Bloqueado por admin') : null;
        await fs.writeFile(USUARIOS_FILE, JSON.stringify(usuarios, null, 2));
        res.json({ success: true, message: `Usuario ${usuario.bloqueado ? 'bloqueado' : 'desbloqueado'}`, usuario });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar estado del usuario' });
    }
});

// ============================================================
// RUTAS DE ADMIN PARA TESTIMONIOS (GESTIÓN)
// ============================================================
app.get('/api/admin/testimonios', verifyAuth, async (req, res) => {
    try {
        const data = await fs.readFile(TESTIMONIOS_FILE, 'utf8');
        const testimonios = JSON.parse(data);
        res.json(testimonios);
    } catch (error) {
        res.status(500).json({ error: 'Error al cargar testimonios' });
    }
});

app.delete('/api/admin/testimonios/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        let testimonios = JSON.parse(await fs.readFile(TESTIMONIOS_FILE, 'utf8'));
        const index = testimonios.findIndex(t => t.id === id);
        if (index === -1) return res.status(404).json({ error: 'Testimonio no encontrado' });
        testimonios.splice(index, 1);
        await fs.writeFile(TESTIMONIOS_FILE, JSON.stringify(testimonios, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar testimonio' });
    }
});

app.put('/api/admin/testimonios/:id/publico', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { publico } = req.body;
        let testimonios = JSON.parse(await fs.readFile(TESTIMONIOS_FILE, 'utf8'));
        const testimonio = testimonios.find(t => t.id === id);
        if (!testimonio) return res.status(404).json({ error: 'Testimonio no encontrado' });
        testimonio.publico = publico === true;
        await fs.writeFile(TESTIMONIOS_FILE, JSON.stringify(testimonios, null, 2));
        res.json({ success: true, testimonio });
    } catch (error) {
        res.status(500).json({ error: 'Error al actualizar el testimonio' });
    }
});

// ============================================================
// RUTAS PÚBLICAS DE TESTIMONIOS
// ============================================================
app.get('/api/testimonios', async (req, res) => {
    try {
        const data = await fs.readFile(TESTIMONIOS_FILE, 'utf8');
        const testimonios = JSON.parse(data);
        const publicos = testimonios
            .filter(t => t.publico === true)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        res.json(publicos);
    } catch (e) {
        console.error('Error al cargar testimonios públicos:', e);
        res.json([]);
    }
});

app.post('/api/testimonios', async (req, res) => {
    try {
        const { nombre, calificacion, comentario, imagen, publico } = req.body;
        if (!nombre || !calificacion || !comentario) {
            return res.status(400).json({ error: 'Nombre, calificación y comentario son obligatorios' });
        }
        const testimonio = {
            id: generarId(),
            nombre: escapeHtml(nombre),
            calificacion: parseInt(calificacion),
            comentario: escapeHtml(comentario),
            imagen: imagen || null,
            publico: publico === true,
            fecha: new Date().toISOString()
        };
        const data = await fs.readFile(TESTIMONIOS_FILE, 'utf8');
        const testimonios = JSON.parse(data);
        testimonios.push(testimonio);
        await fs.writeFile(TESTIMONIOS_FILE, JSON.stringify(testimonios, null, 2));
        res.status(201).json({ success: true, testimonio });
    } catch (e) {
        console.error('Error al guardar testimonio:', e);
        res.status(500).json({ error: 'Error al guardar el testimonio' });
    }
});

// ============================================================
// APLICAR MIDDLEWARE DE SEGURIDAD
// ============================================================
app.use(seguridad.seguridadMiddleware);

// ============================================================
// RUTAS DE SEGURIDAD PARA ADMIN
// ============================================================
app.get('/api/seguridad/ataques', verifyAuth, seguridad.getAtaques);
app.get('/api/seguridad/bloqueos-ip', verifyAuth, seguridad.getBloqueos);
app.post('/api/seguridad/desbloquear-ip/:ip', verifyAuth, seguridad.desbloquearIPAdmin);
app.post('/api/seguridad/bloquear-ip', verifyAuth, seguridad.bloquearIPAdmin);
app.put('/api/seguridad/ataques/:id/resolver', verifyAuth, seguridad.resolverAtaque);
app.delete('/api/seguridad/ataques/:id', verifyAuth, seguridad.eliminarAtaque);
app.get('/api/seguridad/estadisticas', verifyAuth, seguridad.getEstadisticasSeguridad);

// ============================================================
// INICIO DEL SERVIDOR
// ============================================================
const server = app.listen(PORT, '0.0.0.0', async () => {
    await seguridad.initSecurityFiles();
    await initAllFiles();
    console.log(`🌿 Serenity Spa iniciado en puerto ${PORT}`);
    console.log(`📂 Directorio base: ${BASE_DIR}`);
    console.log(`📋 Servicios disponibles: ${serviciosData.length}`);
    console.log(`📍 Ubicación del salón: ${ubicacionSalonGlobal}`);
    console.log(`✅ Sistema de registro de usuarios activo`);
    console.log(`✅ Sistema de testimonios activo`);
    console.log(`🛡️ Sistema de seguridad blindado activo`);
    console.log(`📊 Ataques registrados: ${seguridad.ataquesMemoria.length}`);
    console.log(`🚫 IPs bloqueadas: ${Object.keys(seguridad.bloqueosMemoria).length}`);
});

// ============================================================
// MANEJO DE CIERRE
// ============================================================
process.on('SIGTERM', () => {
    console.log('🛑 Recibido SIGTERM, cerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor cerrado');
        process.exit(0);
    });
});