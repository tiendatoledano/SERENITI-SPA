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
// 🔐 AUTENTICACIÓN ADMIN - LOGIN
// ============================================================
const adminTokens = new Map();

app.post('/api/login', async (req, res) => {
    try {
        const { password } = req.body;
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        console.log('🔐 Intento de login admin');
        
        if (!password) {
            return res.status(400).json({ success: false, mensaje: 'Contraseña requerida' });
        }
        
        if (password === adminPassword) {
            const token = crypto.randomBytes(64).toString('hex');
            adminTokens.set(token, Date.now() + 28800000);
            
            console.log('✅ Login admin exitoso');
            return res.json({ 
                success: true, 
                token: token,
                mensaje: 'Login exitoso'
            });
        } else {
            console.warn('⚠️ Intento de login admin fallido');
            return res.status(401).json({ 
                success: false, 
                mensaje: 'Contraseña incorrecta'
            });
        }
    } catch (error) {
        console.error('❌ Error en login admin:', error);
        res.status(500).json({ success: false, mensaje: 'Error interno del servidor' });
    }
});

// ============================================================
// VERIFICAR TOKEN DE ADMIN
// ============================================================
app.get('/api/verify', (req, res) => {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) {
        return res.json({ valid: false });
    }
    const token = h.substring(7);
    const isValid = adminTokens.has(token) && adminTokens.get(token) > Date.now();
    res.json({ valid: isValid });
});

// ============================================================
// MIDDLEWARE DE AUTENTICACIÓN PARA ADMIN
// ============================================================
function verifyAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    const token = authHeader.substring(7);
    if (!adminTokens.has(token) || adminTokens.get(token) < Date.now()) {
        return res.status(401).json({ error: 'Sesión expirada' });
    }
    next();
}

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
// VERIFICACIÓN DE TOKEN DE USUARIO
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

// ============================================================
// RUTAS PARA TESTIMONIOS - CORREGIDO DEFINITIVO ✅
// ============================================================

// GET - Obtener testimonios públicos
app.get('/api/testimonios', async (req, res) => {
    try {
        console.log('📤 Solicitando testimonios...');
        
        let testimonios = [];
        let archivoExiste = false;
        
        // Verificar si el archivo existe
        try {
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
                console.log('📄 Contenido de testimonios.json:', data);
                
                const parsed = JSON.parse(data);
                if (Array.isArray(parsed)) {
                    testimonios = parsed;
                    console.log(`📂 Testimonios cargados: ${testimonios.length}`);
                } else {
                    console.warn('⚠️ testimonios.json no es un array, usando array vacío');
                    testimonios = [];
                    // Corregir el archivo
                    await fs.writeFile(TESTIMONIOS_FILE, JSON.stringify([], null, 2));
                }
            } catch (e) {
                console.warn('⚠️ Error al leer testimonios.json:', e.message);
                testimonios = [];
                // Recrear el archivo
                await fs.writeFile(TESTIMONIOS_FILE, JSON.stringify([], null, 2));
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
        
        console.log('📝 Recibiendo testimonio:', { 
            nombre, 
            calificacion, 
            comentario: comentario?.substring(0, 30) + '...' 
        });
        
        // VALIDACIONES
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
        
        // Leer archivo existente
        let testimonios = [];
        try {
            const data = await fs.readFile(TESTIMONIOS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                testimonios = parsed;
                console.log(`📂 Testimonios existentes: ${testimonios.length}`);
            } else {
                console.warn('⚠️ testimonios.json no es un array, reiniciando...');
                testimonios = [];
            }
        } catch (e) {
            console.log('📝 Creando nuevo archivo de testimonios');
            testimonios = [];
        }
        
        testimonios.push(testimonio);
        await fs.writeFile(TESTIMONIOS_FILE, JSON.stringify(testimonios, null, 2));
        
        console.log(`✅ Testimonio guardado de ${testimonio.nombre} (${testimonio.calificacion}⭐) - ID: ${testimonio.id}`);
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
// RUTAS DE ADMIN PARA TESTIMONIOS
// ============================================================
app.get('/api/admin/testimonios', verifyAuth, async (req, res) => {
    try {
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
        
        testimonios.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        res.json(testimonios);
    } catch (error) {
        console.error('❌ Error cargando testimonios para admin:', error);
        res.status(500).json({ error: 'Error al cargar testimonios' });
    }
});

app.delete('/api/admin/testimonios/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        
        let testimonios = [];
        try {
            const data = await fs.readFile(TESTIMONIOS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                testimonios = parsed;
            }
        } catch (e) {
            return res.status(404).json({ error: 'No se encontraron testimonios' });
        }
        
        const index = testimonios.findIndex(t => t.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Testimonio no encontrado' });
        }
        
        testimonios.splice(index, 1);
        await fs.writeFile(TESTIMONIOS_FILE, JSON.stringify(testimonios, null, 2));
        
        console.log(`🗑️ Testimonio eliminado: ${id}`);
        res.json({ success: true, message: 'Testimonio eliminado' });
    } catch (error) {
        console.error('❌ Error eliminando testimonio:', error);
        res.status(500).json({ error: 'Error al eliminar testimonio' });
    }
});

app.put('/api/admin/testimonios/:id/publico', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { publico } = req.body;
        
        let testimonios = [];
        try {
            const data = await fs.readFile(TESTIMONIOS_FILE, 'utf8');
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                testimonios = parsed;
            }
        } catch (e) {
            return res.status(404).json({ error: 'No se encontraron testimonios' });
        }
        
        const testimonio = testimonios.find(t => t.id === id);
        if (!testimonio) {
            return res.status(404).json({ error: 'Testimonio no encontrado' });
        }
        
        testimonio.publico = publico === true;
        await fs.writeFile(TESTIMONIOS_FILE, JSON.stringify(testimonios, null, 2));
        
        console.log(`🔄 Testimonio ${id} ahora es ${publico ? 'público' : 'privado'}`);
        res.json({ success: true, testimonio });
    } catch (error) {
        console.error('❌ Error actualizando testimonio:', error);
        res.status(500).json({ error: 'Error al actualizar testimonio' });
    }
});

// ============================================================
// RUTAS PARA TURNOS
// ============================================================

// GET - Obtener todos los turnos
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

// POST - Crear un nuevo turno
app.post('/turnos', async (req, res) => {
    try {
        console.log('📝 Recibiendo solicitud de turno:', req.body);
        
        const { nombre, telefono, massageType, dia, hora, codigoPais, ubicacion, tipoServicio, fecha, ip } = req.body;
        
        if (!nombre || !telefono || !massageType || !dia || hora === undefined || hora === null) {
            console.error('❌ Faltan campos obligatorios');
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        
        const horaNumerica = parseInt(hora);
        if (isNaN(horaNumerica) || horaNumerica < 0 || horaNumerica > 23) {
            return res.status(400).json({ error: 'Hora inválida' });
        }
        
        let turnos = [];
        try {
            const data = await fs.readFile(TURNOS_FILE, 'utf8');
            turnos = JSON.parse(data);
            if (!Array.isArray(turnos)) {
                turnos = [];
            }
        } catch (e) {
            turnos = [];
        }
        
        const diaLower = dia.toLowerCase();
        const fechaTurno = fecha || new Date().toISOString().split('T')[0];
        
        const ocupado = turnos.some(t => {
            return t.dia === diaLower && t.hora === horaNumerica && t.fecha === fechaTurno;
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
            fecha: fechaTurno,
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
        
        console.log(`✅ Turno creado: ${nombre} - ${diaLower} ${horaNumerica}:00 - Código: ${codigoCancelacion}`);
        
        res.status(201).json({
            mensaje: 'Turno reservado exitosamente',
            turno: nuevoTurno,
            codigoCancelacion: codigoCancelacion
        });
        
    } catch (error) {
        console.error('❌ Error creando turno:', error);
        res.status(500).json({ 
            error: 'Error al crear el turno: ' + error.message 
        });
    }
});

// DELETE - Eliminar turno (admin)
app.delete('/turnos/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        
        let turnos = [];
        try {
            const data = await fs.readFile(TURNOS_FILE, 'utf8');
            turnos = JSON.parse(data);
            if (!Array.isArray(turnos)) {
                turnos = [];
            }
        } catch (e) {
            return res.status(404).json({ error: 'No se encontraron turnos' });
        }
        
        const index = turnos.findIndex(t => t.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        turnos.splice(index, 1);
        await fs.writeFile(TURNOS_FILE, JSON.stringify(turnos, null, 2));
        
        console.log(`🗑️ Turno eliminado: ${id}`);
        res.json({ success: true, message: 'Turno eliminado' });
    } catch (error) {
        console.error('❌ Error eliminando turno:', error);
        res.status(500).json({ error: 'Error al eliminar turno' });
    }
});

// POST - Bloquear IP de usuario desde admin
app.post('/api/seguridad/bloquear-usuario/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        
        let turnos = [];
        try {
            const data = await fs.readFile(TURNOS_FILE, 'utf8');
            turnos = JSON.parse(data);
            if (!Array.isArray(turnos)) {
                turnos = [];
            }
        } catch (e) {
            return res.status(404).json({ error: 'No se encontraron turnos' });
        }
        
        const turno = turnos.find(t => t.id === id);
        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        const ip = turno.ip || 'IP desconocida';
        const conteo = (turno.conteoBloqueos || 0) + 1;
        
        // Guardar conteo en el turno
        turno.conteoBloqueos = conteo;
        await fs.writeFile(TURNOS_FILE, JSON.stringify(turnos, null, 2));
        
        console.log(`🔒 IP ${ip} bloqueada (${conteo}ra vez) para usuario ${turno.nombre}`);
        
        res.json({ 
            success: true, 
            ip: ip,
            conteo: conteo,
            mensaje: `IP ${ip} bloqueada (${conteo}ra vez)`
        });
        
    } catch (error) {
        console.error('❌ Error bloqueando IP:', error);
        res.status(500).json({ error: 'Error al bloquear IP' });
    }
});

// ============================================================
// WHATSAPP - ENVIAR MENSAJE DESDE ADMIN
// ============================================================
app.post('/api/enviar-whatsapp/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        
        let turnos = [];
        try {
            const data = await fs.readFile(TURNOS_FILE, 'utf8');
            turnos = JSON.parse(data);
            if (!Array.isArray(turnos)) {
                turnos = [];
            }
        } catch (e) {
            return res.status(404).json({ error: 'No se encontraron turnos' });
        }
        
        const turno = turnos.find(t => t.id === id);
        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        console.log('📤 Preparando mensaje WhatsApp para:', turno.nombre);
        
        // Buscar imagen del servicio
        let imagenWhatsApp = 'https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg';
        try {
            const serviciosData = JSON.parse(await fs.readFile(SERVICIOS_FILE, 'utf8'));
            const servicio = serviciosData.find(s => s.nombre === turno.massageType);
            if (servicio && servicio.imagenWhatsApp) {
                imagenWhatsApp = servicio.imagenWhatsApp;
            }
        } catch (e) {
            console.warn('⚠️ No se pudo obtener imagen del servicio, usando imagen por defecto');
        }
        
        const mensaje = `🌿 *SERENITY SPA*

Hola *${turno.nombre}*, ¡Gracias por escoger nuestro servicio! ✨

✅ *RESERVA CONFIRMADA*

📅 *Día:* ${turno.dia}
📆 *Fecha:* ${turno.fecha}

⏰ *Hora:* ${turno.hora}:00 hs
💆‍♂️ *Masaje:* ${turno.massageType || 'Masaje'}
📍 ${turno.ubicacion || 'Serenity Spa'}

🌸 Te esperamos.
⏱️ Cancelá con 4hs de anticipación.

🖼️ *Imagen:* ${imagenWhatsApp}

*Equipo Serenity Spa*`;
        
        const numero = `${turno.codigoPais || '53'}${turno.telefono}`;
        const whatsappUrl = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
        
        turno.confirmadoWhatsApp = true;
        await fs.writeFile(TURNOS_FILE, JSON.stringify(turnos, null, 2));
        
        console.log(`✅ WhatsApp preparado para ${turno.nombre}`);
        
        res.json({ 
            success: true, 
            numero: numero,
            mensaje: mensaje,
            url: whatsappUrl,
            imagen: imagenWhatsApp
        });
        
    } catch (error) {
        console.error('❌ Error preparando WhatsApp:', error);
        res.status(500).json({ error: 'Error al preparar mensaje' });
    }
});

// ============================================================
// CONFIGURACIÓN - OBTENER Y GUARDAR
// ============================================================
app.get('/api/config', async (req, res) => {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json({});
    }
});

app.put('/api/config', verifyAuth, async (req, res) => {
    try {
        await fs.writeFile(CONFIG_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar configuración' });
    }
});

// ============================================================
// CONFIGURACIÓN REGISTRO - OBTENER Y GUARDAR
// ============================================================
app.get('/api/config/registro', async (req, res) => {
    try {
        const data = await fs.readFile(REGISTRO_CONFIG_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json({});
    }
});

app.put('/api/config/registro', verifyAuth, async (req, res) => {
    try {
        await fs.writeFile(REGISTRO_CONFIG_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar configuración de registro' });
    }
});

// ============================================================
// HORARIOS - OBTENER Y GUARDAR
// ============================================================
app.get('/api/config/horarios', async (req, res) => {
    try {
        const data = await fs.readFile(HORARIOS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json({ dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'], horarios: ['12:00', '16:00', '20:00'] });
    }
});

app.put('/api/config/horarios', verifyAuth, async (req, res) => {
    try {
        await fs.writeFile(HORARIOS_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar horarios' });
    }
});

// ============================================================
// PALABRAS BANEADAS
// ============================================================
app.get('/api/palabras-baneadas', async (req, res) => {
    try {
        const data = await fs.readFile(PALABRAS_BANEADAS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json({ palabras: [] });
    }
});

app.post('/api/palabras-baneadas', verifyAuth, async (req, res) => {
    try {
        const { palabra, accion } = req.body;
        let data = { palabras: [] };
        try {
            data = JSON.parse(await fs.readFile(PALABRAS_BANEADAS_FILE, 'utf8'));
        } catch (e) {}
        
        if (accion === 'agregar') {
            if (!data.palabras.includes(palabra)) {
                data.palabras.push(palabra);
            }
        } else if (accion === 'eliminar') {
            data.palabras = data.palabras.filter(p => p !== palabra);
        }
        
        await fs.writeFile(PALABRAS_BANEADAS_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true, palabras: data.palabras });
    } catch (e) {
        res.status(500).json({ error: 'Error al modificar palabras baneadas' });
    }
});

// ============================================================
// PAÍSES
// ============================================================
app.get('/api/seguridad/paises', async (req, res) => {
    try {
        const data = await fs.readFile(PAISES_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (e) {
        res.json({ autorizados: [], bloqueados: [], modo: 'todos', ubicacionSalon: 'Salón Serenity Spa' });
    }
});

app.put('/api/seguridad/paises', verifyAuth, async (req, res) => {
    try {
        await fs.writeFile(PAISES_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar países' });
    }
});

// ============================================================
// SEGURIDAD - BLOQUEOS
// ============================================================
app.get('/api/seguridad/bloqueos', verifyAuth, async (req, res) => {
    try {
        // Leer archivo de bloqueos si existe
        let bloqueosData = { activos: [], historial: [], intentosFallidos: {} };
        try {
            const data = await fs.readFile(path.join(BASE_DIR, 'bloqueos-seguridad.json'), 'utf8');
            bloqueosData = JSON.parse(data);
        } catch (e) {
            // Archivo no existe, usar datos por defecto
        }
        res.json(bloqueosData);
    } catch (e) {
        res.json({ activos: [], historial: [], intentosFallidos: {} });
    }
});

// ============================================================
// SERVICIOS - CRUD COMPLETO
// ============================================================

// GET - Obtener todos los servicios
app.get('/api/servicios', async (req, res) => {
    try {
        let servicios = [];
        try {
            const data = await fs.readFile(SERVICIOS_FILE, 'utf8');
            servicios = JSON.parse(data);
            if (!Array.isArray(servicios)) {
                servicios = [];
            }
        } catch (e) {
            servicios = [];
        }
        servicios.sort((a, b) => (a.orden || 999) - (b.orden || 999));
        res.json(servicios);
    } catch (e) {
        res.status(500).json({ error: 'Error al obtener servicios' });
    }
});

// POST - Crear un nuevo servicio
app.post('/api/servicios', verifyAuth, async (req, res) => {
    try {
        const { nombre, precio, descripcion, beneficios, efectos, imagenWeb, imagenWhatsApp, videoUrl } = req.body;
        
        if (!nombre || !precio || !descripcion) {
            return res.status(400).json({ error: 'Nombre, precio y descripción son obligatorios' });
        }
        
        let servicios = [];
        try {
            const data = await fs.readFile(SERVICIOS_FILE, 'utf8');
            servicios = JSON.parse(data);
            if (!Array.isArray(servicios)) {
                servicios = [];
            }
        } catch (e) {
            servicios = [];
        }
        
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
            orden: servicios.length + 1
        };
        
        servicios.push(nuevoServicio);
        await fs.writeFile(SERVICIOS_FILE, JSON.stringify(servicios, null, 2));
        
        console.log(`✅ Servicio creado: ${nombre}`);
        res.status(201).json(nuevoServicio);
    } catch (e) {
        console.error('❌ Error creando servicio:', e);
        res.status(500).json({ error: 'Error al crear el servicio' });
    }
});

// PUT - Actualizar un servicio
app.put('/api/servicios/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { nombre, precio, descripcion, beneficios, efectos, imagenWeb, imagenWhatsApp, videoUrl } = req.body;
        
        console.log('📝 Actualizando servicio:', id);
        
        if (!nombre || !precio || !descripcion) {
            return res.status(400).json({ error: 'Nombre, precio y descripción son obligatorios' });
        }
        
        let servicios = [];
        try {
            const data = await fs.readFile(SERVICIOS_FILE, 'utf8');
            servicios = JSON.parse(data);
            if (!Array.isArray(servicios)) {
                servicios = [];
            }
        } catch (e) {
            return res.status(404).json({ error: 'No se encontraron servicios' });
        }
        
        const index = servicios.findIndex(s => s.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }
        
        servicios[index] = {
            ...servicios[index],
            nombre: nombre.trim(),
            precio: precio.trim(),
            descripcion: descripcion.trim(),
            beneficios: beneficios || [],
            efectos: efectos || [],
            imagenWeb: imagenWeb || servicios[index].imagenWeb || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
            imagenWhatsApp: imagenWhatsApp || servicios[index].imagenWhatsApp || '',
            videoUrl: videoUrl || servicios[index].videoUrl || ''
        };
        
        await fs.writeFile(SERVICIOS_FILE, JSON.stringify(servicios, null, 2));
        
        console.log(`✅ Servicio actualizado: ${nombre}`);
        res.json(servicios[index]);
    } catch (e) {
        console.error('❌ Error actualizando servicio:', e);
        res.status(500).json({ error: 'Error al actualizar el servicio' });
    }
});

// DELETE - Eliminar un servicio
app.delete('/api/servicios/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        
        let servicios = [];
        try {
            const data = await fs.readFile(SERVICIOS_FILE, 'utf8');
            servicios = JSON.parse(data);
            if (!Array.isArray(servicios)) {
                servicios = [];
            }
        } catch (e) {
            return res.status(404).json({ error: 'No se encontraron servicios' });
        }
        
        const index = servicios.findIndex(s => s.id === id);
        if (index === -1) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }
        
        servicios.splice(index, 1);
        servicios.forEach((s, i) => s.orden = i + 1);
        await fs.writeFile(SERVICIOS_FILE, JSON.stringify(servicios, null, 2));
        
        console.log(`🗑️ Servicio eliminado: ${id}`);
        res.json({ success: true });
    } catch (e) {
        console.error('❌ Error eliminando servicio:', e);
        res.status(500).json({ error: 'Error al eliminar el servicio' });
    }
});

// ============================================================
// IA - PERSONALIDAD
// ============================================================
app.get('/api/ia/personalidad', async (req, res) => {
    try {
        const data = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
        const iaConfig = data.ia || {
            nombre: 'Asistente Serenity',
            tono: 'cálido y profesional',
            estilo: '',
            reglas: []
        };
        res.json(iaConfig);
    } catch (e) {
        res.json({ 
            nombre: 'Asistente Serenity',
            tono: 'cálido y profesional',
            estilo: '',
            reglas: []
        });
    }
});

app.put('/api/ia/personalidad', verifyAuth, async (req, res) => {
    try {
        const data = JSON.parse(await fs.readFile(CONFIG_FILE, 'utf8'));
        data.ia = {
            nombre: req.body.nombre || 'Asistente Serenity',
            tono: req.body.tono || 'cálido y profesional',
            estilo: req.body.estilo || '',
            reglas: req.body.reglas || []
        };
        await fs.writeFile(CONFIG_FILE, JSON.stringify(data, null, 2));
        res.json({ success: true, data: data.ia });
    } catch (e) {
        console.error('Error guardando personalidad IA:', e);
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// ============================================================
// RUTAS PARA ADMIN - GESTIÓN DE USUARIOS
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
// INICIALIZAR ARCHIVOS
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

// ============================================================
// INICIAR SERVIDOR
// ============================================================
const server = app.listen(PORT, '0.0.0.0', async () => {
    await initAllFiles();
    console.log(`🌿 Serenity Spa iniciado en puerto ${PORT}`);
    console.log(`📂 Directorio base: ${BASE_DIR}`);
    console.log(`🔐 Modo: ${process.env.NODE_ENV || 'development'}`);
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