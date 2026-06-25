const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5001;
const BASE_DIR = __dirname;

// ============================================================
// ARCHIVOS Y DIRECTORIOS
// ============================================================
const DATA_DIR = __dirname;

const TURNOS_FILE = path.join(DATA_DIR, 'turnos.json');
const SERVICIOS_FILE = path.join(DATA_DIR, 'servicios.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PAISES_FILE = path.join(DATA_DIR, 'paises.json');
const HORARIOS_FILE = path.join(DATA_DIR, 'horarios.json');
const PALABRAS_BANEADAS_FILE = path.join(DATA_DIR, 'palabras-baneadas.json');
const REGISTRO_FILE = path.join(DATA_DIR, 'registro-config.json');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(BASE_DIR));

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

// ============================================================
// FUNCIONES DE INICIALIZACIÓN
// ============================================================
async function initAllFiles() {
    console.log('🔧 Inicializando archivos en:', DATA_DIR);
    
    // REGISTRO-CONFIG.json
    if (!fsSync.existsSync(REGISTRO_FILE)) {
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
        await fs.writeFile(REGISTRO_FILE, JSON.stringify(registroDefault, null, 2));
        console.log('✅ registro-config.json creado');
    } else {
        console.log('✅ registro-config.json ya existe');
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
    
    console.log('✅ Todos los archivos inicializados correctamente');
    console.log(`📂 Directorio de datos: ${DATA_DIR}`);
    console.log(`📍 Ubicación del salón: ${ubicacionSalonGlobal}`);
}

// ============================================================
// MIDDLEWARE DE AUTENTICACIÓN
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

// ============================================================
// AUTENTICACIÓN ADMIN
// ============================================================
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

app.post('/api/seguridad/paises/autorizar', verifyAuth, async (req, res) => {
    const { codigo } = req.body;
    try {
        const data = JSON.parse(await fs.readFile(PAISES_FILE, 'utf8'));
        if (!data.autorizados.includes(codigo)) data.autorizados.push(codigo);
        data.bloqueados = data.bloqueados.filter(c => c !== codigo);
        await fs.writeFile(PAISES_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch(e) {
        console.error('Error al autorizar país:', e);
        res.status(500).json({ error: 'Error al autorizar' });
    }
});

app.post('/api/seguridad/paises/bloquear', verifyAuth, async (req, res) => {
    const { codigo } = req.body;
    try {
        const data = JSON.parse(await fs.readFile(PAISES_FILE, 'utf8'));
        if (!data.bloqueados.includes(codigo)) data.bloqueados.push(codigo);
        data.autorizados = data.autorizados.filter(c => c !== codigo);
        await fs.writeFile(PAISES_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true });
    } catch(e) {
        console.error('Error al bloquear país:', e);
        res.status(500).json({ error: 'Error al bloquear' });
    }
});

// ============================================================
// CONFIGURACIÓN REGISTRO
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
            return { descripcion: b.descripcion || b.texto || b.beneficio || '' };
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

// GET - Obtener configuración de registro
app.get('/api/config/registro', async (req, res) => {
    console.log('📤 GET /api/config/registro - Solicitado');
    try {
        let data;
        if (fsSync.existsSync(REGISTRO_FILE)) {
            const fileContent = await fs.readFile(REGISTRO_FILE, 'utf8');
            data = JSON.parse(fileContent);
            console.log('📖 Configuración leída del archivo local');
            console.log('📖 Beneficio 1:', data.beneficios?.[0]?.descripcion);
            console.log('📖 Beneficio 2:', data.beneficios?.[1]?.descripcion);
        } else {
            data = getDefaultRegistroConfig();
            console.log('📖 Usando configuración por defecto');
        }
        const normalized = normalizeRegistroConfig(data);
        res.json(normalized);
    } catch (e) {
        console.error('❌ Error en GET /api/config/registro:', e);
        res.json(getDefaultRegistroConfig());
    }
});

// PUT - Guardar configuración de registro
app.put('/api/config/registro', verifyAuth, async (req, res) => {
    console.log('📥 PUT /api/config/registro - Solicitud recibida');
    try {
        const data = req.body;
        console.log('📝 Datos recibidos:');
        console.log('  - Hero:', data.hero?.titulo);
        console.log('  - Beneficio 1:', data.beneficios?.[0]?.descripcion);
        console.log('  - Beneficio 2:', data.beneficios?.[1]?.descripcion);
        if (!data || typeof data !== 'object') {
            console.error('❌ Datos inválidos');
            return res.status(400).json({ success: false, error: 'Datos inválidos' });
        }
        const normalizedData = normalizeRegistroConfig(data);
        await fs.writeFile(REGISTRO_FILE, JSON.stringify(normalizedData, null, 2));
        console.log('✅ Configuración guardada en archivo local');
        console.log('✅ Guardado - Beneficio 2:', normalizedData.beneficios?.[1]?.descripcion);
        const verifyContent = await fs.readFile(REGISTRO_FILE, 'utf8');
        const verifyData = JSON.parse(verifyContent);
        console.log('✅ Verificación - Beneficio 2:', verifyData.beneficios?.[1]?.descripcion);
        res.json({
            success: true,
            mensaje: 'Contenido de registro guardado correctamente',
            data: normalizedData
        });
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
        fechaCreacion: new Date().toISOString()
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
// RUTA DE DEBUG
// ============================================================
app.get('/api/debug/registro', async (req, res) => {
    try {
        if (fsSync.existsSync(REGISTRO_FILE)) {
            const content = await fs.readFile(REGISTRO_FILE, 'utf8');
            const data = JSON.parse(content);
            res.json({ exists: true, path: REGISTRO_FILE, data: data });
        } else {
            res.json({ exists: false, path: REGISTRO_FILE, message: 'Archivo no existe' });
        }
    } catch(e) {
        res.json({ error: e.message });
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
// INICIO DEL SERVIDOR
// ============================================================
const server = app.listen(PORT, '0.0.0.0', async () => {
    await initAllFiles();
    console.log(`🌿 Serenity Spa iniciado en puerto ${PORT}`);
    console.log(`📂 Directorio base: ${BASE_DIR}`);
    console.log(`📂 Directorio de datos: ${DATA_DIR}`);
    console.log(`📋 Servicios disponibles: ${serviciosData.length}`);
    console.log(`📍 Ubicación del salón: ${ubicacionSalonGlobal}`);
    console.log(`🔍 Ruta de debug: /api/debug/registro`);
    console.log(`📝 Los archivos se guardan en: ${DATA_DIR}`);
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