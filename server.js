const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;
const BASE_DIR = __dirname;

// ============================================================
// VERIFICAR CONFIGURACIÓN DE ENTORNO
// ============================================================
console.log('🔐 ==========================================');
console.log('🔐 VERIFICANDO VARIABLES DE ENTORNO');
console.log('🔐 ==========================================');
console.log('📌 EMAILJS_PUBLIC_KEY:', process.env.EMAILJS_PUBLIC_KEY ? '✅ Configurada' : '❌ No configurada');
console.log('📌 EMAILJS_SERVICE_ID:', process.env.EMAILJS_SERVICE_ID || '❌ No configurado');
console.log('📌 EMAILJS_TEMPLATE_ID:', process.env.EMAILJS_TEMPLATE_ID ? '✅ Configurado' : '❌ No configurado');
console.log('📌 PORT:', process.env.PORT || '5001');
console.log('🔐 ==========================================');

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
const TOKEN_EMAIL_FILE = path.join(BASE_DIR, 'token-email.json');

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(BASE_DIR));

// Middleware anti-cache
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

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
// CONFIGURACIÓN PARA EL FRONTEND (EMAILJS)
// ============================================================
app.get('/api/config-emailjs', (req, res) => {
    res.json({
        publicKey: process.env.EMAILJS_PUBLIC_KEY || '',
        serviceId: process.env.EMAILJS_SERVICE_ID || 'service_oq2z6r7',
        templateId: process.env.EMAILJS_TEMPLATE_ID || ''
    });
});

// ============================================================
// GUARDAR CÓDIGO DE VERIFICACIÓN
// ============================================================
app.post('/api/registro/guardar-codigo', async (req, res) => {
    try {
        const { email, nombre, codigo } = req.body;
        
        const usuarioExistente = usuariosRegistrados.find(u => u.email === email);
        if (usuarioExistente && usuarioExistente.verificado) {
            return res.status(400).json({ error: 'Este email ya está registrado y verificado.' });
        }
        
        const expiracion = Date.now() + 3 * 60 * 1000;
        
        let codigosData = {};
        try {
            const data = await fs.readFile(CODIGOS_FILE, 'utf8');
            codigosData = JSON.parse(data);
        } catch (e) {}
        
        codigosData[email] = {
            codigo: codigo,
            expiracion: expiracion,
            intentos: 0,
            nombre: nombre
        };
        await fs.writeFile(CODIGOS_FILE, JSON.stringify(codigosData, null, 2));
        
        console.log(`✅ Código guardado para ${email}: ${codigo}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error guardando código:', error);
        res.status(500).json({ error: 'Error al guardar código' });
    }
});

// ============================================================
// VERIFICAR CÓDIGO
// ============================================================
app.post('/api/registro/verificar-codigo', async (req, res) => {
    try {
        const { email, codigo } = req.body;
        
        if (!email || !codigo) {
            return res.status(400).json({ error: 'Email y código son requeridos' });
        }
        
        let codigosData = {};
        try {
            const data = await fs.readFile(CODIGOS_FILE, 'utf8');
            codigosData = JSON.parse(data);
        } catch (e) {
            return res.status(400).json({ error: 'Código inválido o expirado.' });
        }
        
        const registro = codigosData[email];
        if (!registro) {
            return res.status(400).json({ error: 'Código inválido o expirado.' });
        }
        
        if (Date.now() > registro.expiracion) {
            delete codigosData[email];
            await fs.writeFile(CODIGOS_FILE, JSON.stringify(codigosData, null, 2));
            return res.status(400).json({ error: 'El código ha expirado.' });
        }
        
        if (registro.intentos >= 5) {
            delete codigosData[email];
            await fs.writeFile(CODIGOS_FILE, JSON.stringify(codigosData, null, 2));
            return res.status(400).json({ error: 'Demasiados intentos.' });
        }
        
        if (registro.codigo !== codigo) {
            registro.intentos = (registro.intentos || 0) + 1;
            codigosData[email] = registro;
            await fs.writeFile(CODIGOS_FILE, JSON.stringify(codigosData, null, 2));
            return res.status(400).json({ error: `Código incorrecto. Te quedan ${5 - registro.intentos} intentos.` });
        }
        
        const nuevoUsuario = {
            id: generarId(),
            nombre: registro.nombre,
            email: email,
            verificado: true,
            fechaRegistro: new Date().toISOString(),
            bloqueado: false,
            motivoBloqueo: null,
            avatar: null
        };
        
        let usuarioExistente = usuariosRegistrados.find(u => u.email === email);
        if (usuarioExistente) {
            if (usuarioExistente.verificado) {
                return res.status(400).json({ error: 'Este email ya está registrado.' });
            } else {
                usuarioExistente.nombre = registro.nombre;
                usuarioExistente.verificado = true;
                usuarioExistente.fechaRegistro = new Date().toISOString();
            }
        } else {
            usuariosRegistrados.push(nuevoUsuario);
            usuarioExistente = nuevoUsuario;
        }
        
        await fs.writeFile(USUARIOS_FILE, JSON.stringify(usuariosRegistrados, null, 2));
        
        delete codigosData[email];
        await fs.writeFile(CODIGOS_FILE, JSON.stringify(codigosData, null, 2));
        
        const token = crypto.randomBytes(64).toString('hex');
        const validTokens = new Map();
        validTokens.set(token, Date.now() + 28800000);
        
        let tokenEmailData = {};
        try {
            const content = await fs.readFile(TOKEN_EMAIL_FILE, 'utf8');
            tokenEmailData = JSON.parse(content);
        } catch (e) {}
        tokenEmailData[token] = email;
        await fs.writeFile(TOKEN_EMAIL_FILE, JSON.stringify(tokenEmailData, null, 2));
        
        res.json({
            success: true,
            token: token,
            usuario: {
                id: usuarioExistente.id,
                nombre: usuarioExistente.nombre,
                email: usuarioExistente.email,
                avatar: usuarioExistente.avatar || null
            }
        });
    } catch (error) {
        console.error('Error en verificar-codigo:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// ============================================================
// VERIFICACIÓN DE TOKEN
// ============================================================
app.get('/api/verify/user', (req, res) => {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) {
        return res.json({ valid: false });
    }
    const token = h.substring(7);
    try {
        const tokenEmailData = JSON.parse(fsSync.readFileSync(TOKEN_EMAIL_FILE, 'utf8'));
        if (tokenEmailData[token]) {
            return res.json({ valid: true });
        }
    } catch (e) {}
    res.json({ valid: false });
});

// ============================================================
// RUTAS PARA TESTIMONIOS - CORREGIDO
// ============================================================

// GET - Obtener testimonios públicos
app.get('/api/testimonios', async (req, res) => {
    try {
        console.log('📤 Solicitando testimonios...');
        
        let testimonios = [];
        let archivoExiste = false;
        
        try {
            // Verificar si el archivo existe
            await fs.access(TESTIMONIOS_FILE);
            archivoExiste = true;
        } catch (e) {
            console.log('📝 testimonios.json no existe, creando...');
            await fs.writeFile(TESTIMONIOS_FILE, JSON.stringify([], null, 2));
            archivoExiste = true;
        }
        
        if (archivoExiste) {
            try {
                const data = await fs.readFile(TESTIMONIOS_FILE, 'utf8');
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    testimonios = parsed;
                    console.log(`📂 Testimonios cargados: ${testimonios.length}`);
                } else {
                    console.warn('⚠️ testimonios.json no es un array, usando array vacío');
                    testimonios = [];
                }
            } catch (e) {
                console.warn('⚠️ Error al leer testimonios.json:', e.message);
                testimonios = [];
            }
        }
        
        // Filtrar solo los públicos y ordenar por fecha (más reciente primero)
        const publicos = testimonios
            .filter(t => t.publico !== false)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        
        console.log(`✅ Testimonios públicos encontrados: ${publicos.length}`);
        res.json(publicos);
        
    } catch (e) {
        console.error('❌ Error cargando testimonios:', e);
        res.json([]); // Siempre devolver un array vacío
    }
});


// POST - Guardar un nuevo testimonio
app.post('/api/testimonios', async (req, res) => {
    try {
        const { nombre, calificacion, comentario, imagen, publico } = req.body;
        
        console.log('📝 Recibiendo testimonio:', { nombre, calificacion });
        
        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        if (!calificacion || isNaN(parseInt(calificacion)) || parseInt(calificacion) < 1 || parseInt(calificacion) > 5) {
            return res.status(400).json({ error: 'La calificación debe ser entre 1 y 5 estrellas' });
        }
        if (!comentario || !comentario.trim() || comentario.trim().length < 3) {
            return res.status(400).json({ error: 'El comentario debe tener al menos 3 caracteres' });
        }
        
        const testimonio = {
            id: generarId(),
            nombre: escapeHtml(nombre.trim()),
            calificacion: parseInt(calificacion),
            comentario: escapeHtml(comentario.trim()),
            imagen: imagen || null,
            publico: publico !== undefined ? publico === true : true,
            fecha: new Date().toISOString()
        };
        
        let testimonios = [];
        try {
            const data = await fs.readFile(TESTIMONIOS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                testimonios = parsed;
            }
        } catch (e) {
            testimonios = [];
        }
        
        testimonios.push(testimonio);
        await fs.writeFile(TESTIMONIOS_FILE, JSON.stringify(testimonios, null, 2));
        
        console.log(`✅ Testimonio guardado de ${testimonio.nombre} (${testimonio.calificacion}⭐)`);
        console.log(`📊 Total testimonios: ${testimonios.length}`);
        
        res.status(201).json({ 
            success: true, 
            testimonio: testimonio,
            message: 'Testimonio guardado exitosamente'
        });
        
    } catch (e) {
        console.error('❌ Error guardando testimonio:', e);
        res.status(500).json({ error: 'Error al guardar el testimonio: ' + e.message });
    }
});

// ============================================================
// RUTAS PARA TURNOS
// ============================================================
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

app.post('/turnos', async (req, res) => {
    try {
        const { nombre, telefono, massageType, dia, hora, codigoPais, ubicacion, tipoServicio, fecha, ip } = req.body;
        
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
        const ubicacionSalonGlobal = 'Salón Serenity Spa';
        
        const nuevoTurno = {
            id: generarId(),
            nombre: escapeHtml(nombre.trim()),
            dia: diaLower,
            fecha: fecha || new Date().toISOString().split('T')[0],
            hora: horaNumerica,
            massageType: massageType,
            telefono: telefono.replace(/\D/g, ''),
            codigoPais: codigoPais || '53',
            ubicacion: ubicacion || ubicacionSalonGlobal,
            tipoServicio: tipoServicio || 'salon',
            confirmadoWhatsApp: false,
            fechaCreacion: new Date().toISOString(),
            codigoCancelacion: codigoCancelacion,
            ip: ip || 'N/A'
        };
        
        turnos.push(nuevoTurno);
        await fs.writeFile(TURNOS_FILE, JSON.stringify(turnos, null, 2));
        
        res.status(201).json({
            mensaje: 'Turno reservado',
            turno: nuevoTurno,
            codigoCancelacion: codigoCancelacion
        });
    } catch (error) {
        console.error('Error creando turno:', error);
        res.status(500).json({ error: 'Error al crear el turno' });
    }
});

// ============================================================
// RUTAS PARA SERVICIOS
// ============================================================
let serviciosData = [];
let usuariosRegistrados = [];

async function initAllFiles() {
    console.log('🔧 Inicializando archivos...');
    
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
        serviciosData = [];
    }
    
    if (!fsSync.existsSync(USUARIOS_FILE)) {
        await fs.writeFile(USUARIOS_FILE, JSON.stringify([], null, 2));
        console.log('✅ registro-usuarios.json creado');
    }
    try {
        const data = await fs.readFile(USUARIOS_FILE, 'utf8');
        usuariosRegistrados = JSON.parse(data);
        console.log(`✅ Usuarios cargados: ${usuariosRegistrados.length}`);
    } catch(e) {
        usuariosRegistrados = [];
    }
    
    // 🔥 CREAR TESTIMONIOS.json si no existe
    if (!fsSync.existsSync(TESTIMONIOS_FILE)) {
        await fs.writeFile(TESTIMONIOS_FILE, JSON.stringify([], null, 2));
        console.log('✅ testimonios.json creado');
    }
    
    const archivos = [TURNOS_FILE, CONFIG_FILE, PAISES_FILE, HORARIOS_FILE, PALABRAS_BANEADAS_FILE, REGISTRO_CONFIG_FILE, TOKEN_EMAIL_FILE, CODIGOS_FILE];
    for (const archivo of archivos) {
        if (!fsSync.existsSync(archivo)) {
            await fs.writeFile(archivo, JSON.stringify({}, null, 2));
            console.log(`✅ ${path.basename(archivo)} creado`);
        }
    }
    
    console.log('✅ Todos los archivos inicializados');
}

app.get('/api/servicios', (req, res) => {
    try {
        const sorted = [...serviciosData].sort((a, b) => (a.orden || 999) - (b.orden || 999));
        res.json(sorted);
    } catch(e) {
        res.status(500).json({ error: 'Error al obtener servicios' });
    }
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
const server = app.listen(PORT, '0.0.0.0', async () => {
    await initAllFiles();
    console.log(`🌿 Serenity Spa iniciado en puerto ${PORT}`);
    console.log(`📂 Directorio base: ${BASE_DIR}`);
    console.log(`🔐 Modo: ${process.env.NODE_ENV || 'development'}`);
});