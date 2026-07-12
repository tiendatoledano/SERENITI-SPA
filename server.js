// ============================================================
// server.js - SERVIDOR OPTIMIZADO
// ============================================================

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const compression = require('compression');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;
const BASE_DIR = __dirname;

// Importar servicios de Supabase
const db = require('./supabase-service');

// ============================================================
// MIDDLEWARE DE RENDIMIENTO
// ============================================================

// Compresión Gzip/Brotli
app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

// Headers de seguridad
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Limitar payload
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cache estático optimizado
const staticOptions = {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg|webp)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
        }
    }
};
app.use(express.static(BASE_DIR, staticOptions));

// Headers anti-cache para HTML
app.use((req, res, next) => {
    if (req.path.endsWith('.html') || req.path === '/') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// Timeout para peticiones largas
app.use((req, res, next) => {
    req.setTimeout(30000);
    res.setTimeout(30000);
    next();
});

// ============================================================
// FUNCIONES UTILITARIAS
// ============================================================
function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6) + crypto.randomBytes(4).toString('hex');
}

function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ============================================================
// RUTAS HTML - CON CACHE CONTROL
// ============================================================
const sendHtml = (file) => (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(BASE_DIR, file));
};

app.get('/', sendHtml('index.html'));
app.get('/admin', sendHtml('admin.html'));
app.get('/admin.html', sendHtml('admin.html'));
app.get('/login', sendHtml('login.html'));
app.get('/login.html', sendHtml('login.html'));
app.get('/registro', sendHtml('registro.html'));
app.get('/registro.html', sendHtml('registro.html'));
app.get('/asistente', sendHtml('asistente.html'));
app.get('/terminos', sendHtml('terminos.html'));

// ============================================================
// CONFIGURACIÓN EMAILJS
// ============================================================
app.get('/api/config-emailjs', (req, res) => {
    res.json({
        publicKey: process.env.EMAILJS_PUBLIC_KEY || '',
        serviceId: process.env.EMAILJS_SERVICE_ID || 'service_oq2z6r7',
        templateId: process.env.EMAILJS_TEMPLATE_ID || ''
    });
});

// ============================================================
// AUTENTICACIÓN ADMIN
// ============================================================
const adminTokens = new Map();

app.post('/api/login', async (req, res) => {
    try {
        const { password } = req.body;
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
        
        if (!password) {
            return res.status(400).json({ success: false, mensaje: 'Contraseña requerida' });
        }
        
        if (password === adminPassword) {
            const token = crypto.randomBytes(64).toString('hex');
            adminTokens.set(token, Date.now() + 28800000);
            return res.json({ success: true, token, mensaje: 'Login exitoso' });
        } else {
            return res.status(401).json({ success: false, mensaje: 'Contraseña incorrecta' });
        }
    } catch (error) {
        console.error('❌ Error en login admin:', error);
        res.status(500).json({ success: false, mensaje: 'Error interno' });
    }
});

app.get('/api/verify', (req, res) => {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) {
        return res.json({ valid: false });
    }
    const token = h.substring(7);
    const isValid = adminTokens.has(token) && adminTokens.get(token) > Date.now();
    res.json({ valid: isValid });
});

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
// REGISTRO DE USUARIOS
// ============================================================
app.post('/api/registro/guardar-codigo', async (req, res) => {
    try {
        const { email, nombre, codigo } = req.body;
        
        if (!email || !nombre || !codigo) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }
        
        const usuarioExistente = await db.getUsuarioByEmail(email);
        if (usuarioExistente && usuarioExistente.verificado) {
            return res.status(400).json({ error: 'Este email ya está registrado y verificado.' });
        }
        
        const expiracion = Date.now() + 3 * 60 * 1000;
        
        await db.upsertCodigoVerificacion(email, {
            codigo: codigo,
            expiracion: expiracion,
            intentos: 0,
            nombre: nombre
        });
        
        console.log(`✅ Código guardado para ${email}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error guardando código:', error);
        res.status(500).json({ error: 'Error al guardar código' });
    }
});

app.post('/api/registro/verificar-codigo', async (req, res) => {
    try {
        const { email, codigo } = req.body;
        
        if (!email || !codigo) {
            return res.status(400).json({ error: 'Email y código son requeridos' });
        }
        
        const registro = await db.getCodigoVerificacion(email);
        if (!registro) {
            return res.status(400).json({ error: 'Código inválido o expirado.' });
        }
        
        if (Date.now() > registro.expiracion) {
            await db.deleteCodigoVerificacion(email);
            return res.status(400).json({ error: 'El código ha expirado.' });
        }
        
        if (registro.intentos >= 5) {
            await db.deleteCodigoVerificacion(email);
            return res.status(400).json({ error: 'Demasiados intentos.' });
        }
        
        if (registro.codigo !== codigo) {
            await db.upsertCodigoVerificacion(email, {
                ...registro,
                intentos: (registro.intentos || 0) + 1
            });
            return res.status(400).json({ error: `Código incorrecto. Te quedan ${5 - (registro.intentos || 0) - 1} intentos.` });
        }
        
        let usuarioExistente = await db.getUsuarioByEmail(email);
        
        if (usuarioExistente && usuarioExistente.verificado) {
            return res.status(400).json({ error: 'Este email ya está registrado.' });
        }
        
        const nuevoUsuario = {
            id: generarId(),
            nombre: registro.nombre,
            email: email,
            verificado: true,
            fecha_registro: new Date().toISOString(),
            bloqueado: false,
            motivo_bloqueo: null,
            avatar: null
        };
        
        if (usuarioExistente) {
            await db.updateUsuario(usuarioExistente.id, {
                ...usuarioExistente,
                nombre: registro.nombre,
                verificado: true
            });
        } else {
            await db.createUsuario(nuevoUsuario);
        }
        
        await db.deleteCodigoVerificacion(email);
        
        const token = crypto.randomBytes(64).toString('hex');
        await db.createTokenUsuario(token, email);
        
        const usuario = await db.getUsuarioByEmail(email);
        
        res.json({
            success: true,
            token: token,
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                avatar: usuario.avatar || null
            }
        });
    } catch (error) {
        console.error('Error en verificar-codigo:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

app.get('/api/verify/user', async (req, res) => {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) {
        return res.json({ valid: false });
    }
    const token = h.substring(7);
    try {
        const usuario = await db.getUsuarioByToken(token);
        if (usuario) {
            return res.json({ valid: true });
        }
    } catch (e) {}
    res.json({ valid: false });
});

// ============================================================
// TESTIMONIOS
// ============================================================
app.get('/api/testimonios', async (req, res) => {
    try {
        const testimonios = await db.getTestimonios(true);
        res.json(testimonios);
    } catch (e) {
        console.error('❌ Error cargando testimonios:', e);
        res.json([]);
    }
});

app.post('/api/testimonios', async (req, res) => {
    try {
        const { nombre, calificacion, comentario, imagen, publico } = req.body;
        
        if (!nombre || !nombre.trim() || nombre.trim().length < 2) {
            return res.status(400).json({ error: 'El nombre debe tener al menos 2 caracteres' });
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
        
        await db.createTestimonio(testimonio);
        
        console.log(`✅ Testimonio guardado de ${testimonio.nombre} (${testimonio.calificacion}⭐)`);
        
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

// ADMIN - Testimonios
app.get('/api/admin/testimonios', verifyAuth, async (req, res) => {
    try {
        const testimonios = await db.getTestimonios(false);
        res.json(testimonios);
    } catch (error) {
        console.error('❌ Error cargando testimonios para admin:', error);
        res.status(500).json({ error: 'Error al cargar testimonios' });
    }
});

app.delete('/api/admin/testimonios/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        await db.deleteTestimonio(id);
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
        
        const testimonio = await db.getTestimonioById(id);
        if (!testimonio) {
            return res.status(404).json({ error: 'Testimonio no encontrado' });
        }
        
        await db.updateTestimonio(id, { publico: publico === true });
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error actualizando testimonio:', error);
        res.status(500).json({ error: 'Error al actualizar testimonio' });
    }
});

// ============================================================
// TURNOS
// ============================================================
app.get('/turnos', async (req, res) => {
    try {
        const turnos = await db.getTurnos();
        res.json(turnos);
    } catch (error) {
        console.error('Error obteniendo turnos:', error);
        res.json([]);
    }
});

app.post('/turnos', async (req, res) => {
    try {
        const { nombre, telefono, massageType, dia, hora, codigoPais, ubicacion, tipoServicio, fecha, ip } = req.body;
        
        if (!nombre || !telefono || !massageType || !dia || hora === undefined || hora === null) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        
        const horaNumerica = parseInt(hora);
        if (isNaN(horaNumerica) || horaNumerica < 0 || horaNumerica > 23) {
            return res.status(400).json({ error: 'Hora inválida' });
        }
        
        const horariosConfig = await db.getHorarios();
        const diaLower = dia.toLowerCase();
        if (!horariosConfig.dias || !horariosConfig.dias.includes(diaLower)) {
            return res.status(400).json({ error: 'El día seleccionado no es laboral' });
        }
        
        const inicio = horariosConfig.inicio || 8;
        const fin = horariosConfig.fin || 20;
        if (horaNumerica < inicio || horaNumerica >= fin) {
            return res.status(400).json({ error: `Horario fuera del rango laboral (${inicio}:00 - ${fin}:00)` });
        }
        
        const fechaTurno = fecha || new Date().toISOString().split('T')[0];
        
        const turnosExistentes = await db.getTurnosByFecha(fechaTurno);
        const ocupado = turnosExistentes.some(t => {
            return t.dia === diaLower && t.hora === horaNumerica;
        });
        
        if (ocupado) {
            return res.status(409).json({ error: 'Horario ocupado' });
        }
        
        const telefonoLimpio = telefono.replace(/\D/g, '');
        const turnosDelUsuario = turnosExistentes.filter(t => 
            t.telefono === telefonoLimpio && 
            t.dia === diaLower
        );
        
        if (turnosDelUsuario.length >= 2) {
            return res.status(429).json({ 
                error: '⚠️ Límite alcanzado: Solo puedes reservar 2 masajes por día. Ya tienes ' + turnosDelUsuario.length + ' turnos para hoy.' 
            });
        }
        
        const codigoCancelacion = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const nuevoTurno = {
            id: generarId(),
            nombre: escapeHtml(nombre.trim()),
            dia: diaLower,
            fecha: fechaTurno,
            hora: horaNumerica,
            massage_type: massageType,
            telefono: telefonoLimpio,
            codigo_pais: codigoPais || '53',
            ubicacion: ubicacion || 'Salón Serenity Spa',
            tipo_servicio: tipoServicio || 'salon',
            confirmado_whatsapp: false,
            fecha_creacion: new Date().toISOString(),
            codigo_cancelacion: codigoCancelacion,
            ip: ip || req.ip || 'N/A',
            conteo_bloqueos: 0,
            bloqueado: false
        };
        
        await db.createTurno(nuevoTurno);
        
        console.log(`✅ Turno creado: ${nombre} - ${diaLower} ${horaNumerica}:00`);
        
        res.status(201).json({
            mensaje: 'Turno reservado exitosamente',
            turno: nuevoTurno,
            codigoCancelacion: codigoCancelacion
        });
        
    } catch (error) {
        console.error('❌ Error creando turno:', error);
        res.status(500).json({ error: 'Error al crear el turno: ' + error.message });
    }
});

app.delete('/turnos/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        await db.deleteTurno(id);
        res.json({ success: true, message: 'Turno eliminado' });
    } catch (error) {
        console.error('❌ Error eliminando turno:', error);
        res.status(500).json({ error: 'Error al eliminar turno' });
    }
});

// ============================================================
// WHATSAPP
// ============================================================
app.post('/api/enviar-whatsapp/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const turno = await db.getTurnoById(id);
        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        let imagenWhatsApp = '';
        
        try {
            const servicios = await db.getServicios();
            const servicio = servicios.find(s => 
                s.nombre.toLowerCase() === turno.massage_type.toLowerCase()
            );
            
            if (servicio && servicio.imagen_whatsapp) {
                imagenWhatsApp = servicio.imagen_whatsapp.trim();
            }
        } catch (e) {
            console.error('❌ Error obteniendo imagen del servicio:', e);
        }
        
        if (!imagenWhatsApp) {
            imagenWhatsApp = 'https://i.postimg.cc/Hct3ps1K/photo-1519823551278-64ac92734fb1.jpg';
        }
        
        const mensaje = `🌿 *SERENITY SPA*

Hola *${turno.nombre}*, ¡Gracias por escoger nuestro servicio! ✨

✅ *RESERVA CONFIRMADA*

📅 *Día:* ${turno.dia}
📆 *Fecha:* ${turno.fecha}

⏰ *Hora:* ${turno.hora}:00 hs
💆‍♂️ *Masaje:* ${turno.massage_type || 'Masaje'}
📍 ${turno.ubicacion || 'Serenity Spa'}

🌸 Te esperamos.
⏱️ Cancelá con 4hs de anticipación.

📸 Imagen del servicio: ${imagenWhatsApp}

*Equipo Serenity Spa*`;
        
        const numero = `${turno.codigo_pais || '53'}${turno.telefono}`;
        const whatsappUrl = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
        
        await db.updateTurno(id, { confirmado_whatsapp: true });
        
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
// SEGURIDAD - BLOQUEOS
// ============================================================
app.post('/api/seguridad/bloquear-usuario/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        
        const turno = await db.getTurnoById(id);
        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        const ip = turno.ip || 'IP desconocida';
        if (ip === 'IP desconocida' || ip === 'N/A') {
            return res.status(400).json({ error: 'No se puede bloquear: IP desconocida' });
        }
        
        const bloqueosExistentes = await db.getBloqueosActivos();
        const bloqueosIP = bloqueosExistentes.filter(b => b.ip === ip);
        const conteo = bloqueosIP.length + 1;
        
        let duracionHoras = 1;
        let permanente = false;
        let motivo = '';
        
        if (conteo >= 3) {
            permanente = true;
            motivo = 'Bloqueo permanente - 3ra infracción';
        } else if (conteo === 2) {
            duracionHoras = 2;
            motivo = `2da infracción - Bloqueo de 2 horas`;
        } else {
            duracionHoras = 1;
            motivo = `1ra infracción - Bloqueo de 1 hora`;
        }
        
        const expiracion = new Date();
        expiracion.setHours(expiracion.getHours() + duracionHoras);
        
        const bloqueo = {
            ip: ip,
            tipoAtaque: 'Uso indebido',
            motivo: motivo,
            fecha: new Date().toISOString(),
            hasta: permanente ? null : expiracion.toISOString(),
            permanente: permanente,
            intentos: conteo,
            usuario_id: turno.nombre || 'Desconocido'
        };
        
        const { error } = await db.supabase
            .from('bloqueos')
            .insert([bloqueo]);
        
        if (error) {
            console.error('Error guardando bloqueo:', error);
            return res.status(500).json({ error: 'Error al guardar bloqueo' });
        }
        
        await db.updateTurno(id, { 
            conteo_bloqueos: conteo,
            bloqueado: true 
        });
        
        res.json({ 
            success: true, 
            ip: ip,
            conteo: conteo,
            permanente: permanente,
            duracionHoras: duracionHoras,
            mensaje: permanente ? 
                'IP bloqueada permanentemente' : 
                `IP bloqueada por ${duracionHoras} hora${duracionHoras > 1 ? 's' : ''}`
        });
        
    } catch (error) {
        console.error('❌ Error bloqueando usuario:', error);
        res.status(500).json({ error: 'Error al bloquear usuario' });
    }
});

app.get('/api/seguridad/bloqueos', verifyAuth, async (req, res) => {
    try {
        const bloqueos = await db.getBloqueosActivos();
        res.json({ 
            activos: bloqueos, 
            historial: [], 
            intentosFallidos: {} 
        });
    } catch (e) {
        console.error('❌ Error obteniendo bloqueos:', e);
        res.json({ activos: [], historial: [], intentosFallidos: {} });
    }
});

app.post('/api/seguridad/desbloquear/:ip', verifyAuth, async (req, res) => {
    try {
        const ip = req.params.ip;
        await db.deleteBloqueoByIP(ip);
        res.json({ ok: true, mensaje: 'IP desbloqueada' });
    } catch (e) {
        res.status(500).json({ error: 'Error al desbloquear IP' });
    }
});

app.delete('/api/seguridad/bloqueos/:ip', verifyAuth, async (req, res) => {
    try {
        const ip = req.params.ip;
        await db.deleteBloqueoByIP(ip);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al eliminar bloqueo' });
    }
});

// ============================================================
// HORARIOS DISPONIBLES
// ============================================================
app.get('/api/horarios-disponibles', async (req, res) => {
    try {
        const { fecha, dia, modalidad } = req.query;
        
        if (!fecha || !dia) {
            return res.status(400).json({ error: 'Fecha y día son requeridos' });
        }
        
        const horariosConfig = await db.getHorarios();
        const diaLower = dia.toLowerCase();
        
        if (!horariosConfig.dias || !horariosConfig.dias.includes(diaLower)) {
            return res.json({ disponibles: [], mensaje: 'Día no laboral', esLaboral: false });
        }
        
        const modalidadesConfig = await db.getModalidades();
        let intervaloHoras = 1;
        let tipoServicio = modalidad || 'salon';
        
        if (tipoServicio === 'domicilio') {
            if (!modalidadesConfig.domicilio_activo) {
                return res.json({ disponibles: [], mensaje: 'Servicio a domicilio no disponible', esLaboral: true });
            }
            intervaloHoras = 3;
        } else {
            if (!modalidadesConfig.salon_activo) {
                return res.json({ disponibles: [], mensaje: 'Servicio en salón no disponible', esLaboral: true });
            }
        }
        
        const turnos = await db.getTurnosByFecha(fecha);
        const ocupados = turnos.filter(t => t.dia === diaLower).map(t => t.hora);
        
        const disponibles = [];
        const inicio = horariosConfig.inicio || 8;
        const fin = horariosConfig.fin || 20;
        
        for (let h = inicio; h < fin; h += intervaloHoras) {
            if (!ocupados.includes(h)) {
                disponibles.push({
                    hora: h,
                    horaStr: `${h.toString().padStart(2, '0')}:00`,
                    disponible: true
                });
            }
        }
        
        res.json({
            disponibles,
            intervaloHoras,
            modalidad: tipoServicio,
            inicio,
            fin,
            diasLaborales: horariosConfig.dias,
            esLaboral: true,
            salonActivo: modalidadesConfig.salon_activo !== false,
            domicilioActivo: modalidadesConfig.domicilio_activo !== false
        });
        
    } catch (error) {
        console.error('❌ Error calculando horarios:', error);
        res.status(500).json({ error: 'Error al calcular horarios disponibles' });
    }
});

// ============================================================
// CONFIGURACIÓN
// ============================================================
app.get('/api/config', async (req, res) => {
    try {
        const config = await db.getConfiguracion('general');
        res.json(config || {});
    } catch (e) {
        res.json({});
    }
});

app.put('/api/config', verifyAuth, async (req, res) => {
    try {
        await db.setConfiguracion('general', req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar configuración' });
    }
});

app.get('/api/config/registro', async (req, res) => {
    try {
        const config = await db.getConfiguracionRegistro();
        res.json(config);
    } catch (e) {
        res.json({});
    }
});

app.put('/api/config/registro', verifyAuth, async (req, res) => {
    try {
        await db.setConfiguracionRegistro(req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar configuración de registro' });
    }
});

// ============================================================
// HORARIOS
// ============================================================
app.get('/api/config/horarios', async (req, res) => {
    try {
        const horarios = await db.getHorarios();
        res.json(horarios);
    } catch (e) {
        console.error('❌ Error obteniendo horarios:', e);
        res.json({ 
            dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'], 
            horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
            inicio: 8,
            fin: 20
        });
    }
});

app.put('/api/config/horarios', verifyAuth, async (req, res) => {
    try {
        const data = req.body;
        
        if (!data.dias || !Array.isArray(data.dias) || data.dias.length === 0) {
            return res.status(400).json({ 
                error: 'Debes seleccionar al menos un día de atención'
            });
        }
        
        if (!data.horarios || !Array.isArray(data.horarios) || data.horarios.length === 0) {
            return res.status(400).json({ 
                error: 'Debes tener al menos un horario disponible'
            });
        }
        
        if (data.inicio === undefined || data.fin === undefined) {
            return res.status(400).json({ 
                error: 'El rango horario es incompleto'
            });
        }
        
        if (data.inicio >= data.fin) {
            return res.status(400).json({ 
                error: 'La hora de inicio debe ser menor que la de cierre'
            });
        }
        
        const datosLimpios = {
            dias: data.dias.map(d => d.toLowerCase().trim()),
            horarios: data.horarios.filter(h => h && h.trim()).sort(),
            inicio: data.inicio,
            fin: data.fin
        };
        
        await db.setHorarios(datosLimpios);
        
        res.json({ 
            success: true, 
            data: datosLimpios,
            message: 'Horarios guardados correctamente'
        });
        
    } catch (e) {
        console.error('❌ Error guardando horarios:', e);
        res.status(500).json({ 
            error: 'Error al guardar horarios: ' + e.message
        });
    }
});

// ============================================================
// MODALIDADES
// ============================================================
app.get('/api/config/modalidades', async (req, res) => {
    try {
        const modalidades = await db.getModalidades();
        res.json({
            salon: { activo: modalidades.salon_activo !== false },
            domicilio: { activo: modalidades.domicilio_activo !== false }
        });
    } catch (e) {
        res.json({ salon: { activo: true }, domicilio: { activo: true } });
    }
});

app.put('/api/config/modalidades', verifyAuth, async (req, res) => {
    try {
        await db.setModalidades({
            salon_activo: req.body.salon?.activo !== false,
            domicilio_activo: req.body.domicilio?.activo !== false
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar modalidades' });
    }
});

// ============================================================
// PAÍSES
// ============================================================
app.get('/api/seguridad/paises', async (req, res) => {
    try {
        const paises = await db.getPaises();
        res.json({
            autorizados: paises.autorizados || [],
            bloqueados: paises.bloqueados || [],
            modo: paises.modo || 'todos',
            ubicacionSalon: paises.ubicacion_salon || 'Salón Serenity Spa'
        });
    } catch (e) {
        res.json({ autorizados: [], bloqueados: [], modo: 'todos', ubicacionSalon: 'Salón Serenity Spa' });
    }
});

app.put('/api/seguridad/paises', verifyAuth, async (req, res) => {
    try {
        await db.setPaises({
            autorizados: req.body.autorizados || [],
            bloqueados: req.body.bloqueados || [],
            modo: req.body.modo || 'todos',
            ubicacion_salon: req.body.ubicacionSalon || 'Salón Serenity Spa'
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar países' });
    }
});

// ============================================================
// PALABRAS BANEADAS
// ============================================================
app.get('/api/palabras-baneadas', async (req, res) => {
    try {
        const palabras = await db.getPalabrasBaneadas();
        res.json({ palabras });
    } catch (e) {
        res.json({ palabras: [] });
    }
});

app.post('/api/palabras-baneadas', verifyAuth, async (req, res) => {
    try {
        const { palabra, accion } = req.body;
        
        if (!palabra || !palabra.trim()) {
            return res.status(400).json({ error: 'La palabra es requerida' });
        }
        
        const palabraLimpia = palabra.trim().toLowerCase();
        
        if (accion === 'agregar') {
            await db.addPalabraBaneada(palabraLimpia);
        } else if (accion === 'eliminar') {
            await db.removePalabraBaneada(palabraLimpia);
        } else {
            return res.status(400).json({ error: 'Acción inválida' });
        }
        
        const palabras = await db.getPalabrasBaneadas();
        res.json({ success: true, palabras });
    } catch (e) {
        console.error('❌ Error modificando palabras baneadas:', e);
        res.status(500).json({ error: 'Error al modificar palabras baneadas' });
    }
});

// ============================================================
// SERVICIOS
// ============================================================
app.get('/api/servicios', async (req, res) => {
    try {
        const servicios = await db.getServicios();
        const serviciosFormateados = servicios.map(s => ({
            id: s.id,
            nombre: s.nombre,
            precio: s.precio,
            descripcion: s.descripcion,
            beneficios: s.beneficios || [],
            efectos: s.efectos || [],
            imagenWeb: s.imagen_web || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
            imagenWhatsApp: s.imagen_whatsapp || '',
            videoUrl: s.video_url || '',
            orden: s.orden || 0
        }));
        res.json(serviciosFormateados);
    } catch (e) {
        console.error('❌ Error obteniendo servicios:', e);
        res.status(500).json({ error: 'Error al obtener servicios' });
    }
});

app.post('/api/servicios', verifyAuth, async (req, res) => {
    try {
        const { nombre, precio, descripcion, beneficios, efectos, imagenWeb, imagenWhatsApp, videoUrl } = req.body;
        
        if (!nombre || !precio || !descripcion) {
            return res.status(400).json({ error: 'Nombre, precio y descripción son obligatorios' });
        }
        
        const servicios = await db.getServicios();
        
        const nuevoServicio = {
            id: generarId(),
            nombre: nombre.trim(),
            precio: precio.trim(),
            descripcion: descripcion.trim(),
            beneficios: beneficios || [],
            efectos: efectos || [],
            imagen_web: imagenWeb || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
            imagen_whatsapp: imagenWhatsApp || '',
            video_url: videoUrl || '',
            orden: servicios.length + 1
        };
        
        await db.createServicio(nuevoServicio);
        
        res.status(201).json({
            id: nuevoServicio.id,
            nombre: nuevoServicio.nombre,
            precio: nuevoServicio.precio,
            descripcion: nuevoServicio.descripcion,
            beneficios: nuevoServicio.beneficios,
            efectos: nuevoServicio.efectos,
            imagenWeb: nuevoServicio.imagen_web,
            imagenWhatsApp: nuevoServicio.imagen_whatsapp,
            videoUrl: nuevoServicio.video_url,
            orden: nuevoServicio.orden
        });
    } catch (e) {
        console.error('❌ Error creando servicio:', e);
        res.status(500).json({ error: 'Error al crear el servicio' });
    }
});

app.put('/api/servicios/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { nombre, precio, descripcion, beneficios, efectos, imagenWeb, imagenWhatsApp, videoUrl } = req.body;
        
        if (!nombre || !precio || !descripcion) {
            return res.status(400).json({ error: 'Nombre, precio y descripción son obligatorios' });
        }
        
        const servicioExistente = await db.getServicioById(id);
        if (!servicioExistente) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }
        
        const servicioActualizado = {
            nombre: nombre.trim(),
            precio: precio.trim(),
            descripcion: descripcion.trim(),
            beneficios: beneficios || [],
            efectos: efectos || [],
            imagen_web: imagenWeb || servicioExistente.imagen_web || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
            imagen_whatsapp: imagenWhatsApp || servicioExistente.imagen_whatsapp || '',
            video_url: videoUrl || servicioExistente.video_url || ''
        };
        
        await db.updateServicio(id, servicioActualizado);
        
        res.json({
            id: id,
            nombre: servicioActualizado.nombre,
            precio: servicioActualizado.precio,
            descripcion: servicioActualizado.descripcion,
            beneficios: servicioActualizado.beneficios,
            efectos: servicioActualizado.efectos,
            imagenWeb: servicioActualizado.imagen_web,
            imagenWhatsApp: servicioActualizado.imagen_whatsapp,
            videoUrl: servicioActualizado.video_url,
            orden: servicioExistente.orden || 0
        });
    } catch (e) {
        console.error('❌ Error actualizando servicio:', e);
        res.status(500).json({ error: 'Error al actualizar el servicio' });
    }
});

app.delete('/api/servicios/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        await db.deleteServicio(id);
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
        const config = await db.getConfiguracion('ia');
        res.json(config || {
            nombre: 'Asistente Serenity',
            tono: 'cálido y profesional',
            estilo: '',
            reglas: []
        });
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
        const iaConfig = {
            nombre: req.body.nombre || 'Asistente Serenity',
            tono: req.body.tono || 'cálido y profesional',
            estilo: req.body.estilo || '',
            reglas: req.body.reglas || []
        };
        await db.setConfiguracion('ia', iaConfig);
        res.json({ success: true, data: iaConfig });
    } catch (e) {
        console.error('Error guardando personalidad IA:', e);
        res.status(500).json({ error: 'Error al guardar' });
    }
});

app.post('/api/ia/recargar', verifyAuth, async (req, res) => {
    try {
        const servicios = await db.getServicios();
        const config = await db.getConfiguracion('ia');
        
        res.json({ 
            success: true, 
            items: servicios.length,
            recargaInfo: {
                ultimaRecarga: new Date().toISOString(),
                items: servicios.length,
                configuracion: config || {}
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'Error al recargar conocimiento' });
    }
});

// ============================================================
// ADMIN - USUARIOS
// ============================================================
app.get('/api/usuarios', verifyAuth, async (req, res) => {
    try {
        const usuarios = await db.getUsuarios();
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: 'Error al cargar usuarios' });
    }
});

app.delete('/api/usuarios/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        await db.deleteUsuario(id);
        res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

app.put('/api/usuarios/:id/bloquear', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { motivo } = req.body;
        const usuario = await db.getUsuarioById(id);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        const nuevoEstado = !usuario.bloqueado;
        await db.updateUsuario(id, { 
            bloqueado: nuevoEstado,
            motivo_bloqueo: nuevoEstado ? (motivo || 'Bloqueado por admin') : null
        });
        
        res.json({ 
            success: true, 
            message: `Usuario ${nuevoEstado ? 'bloqueado' : 'desbloqueado'}`,
            usuario: { ...usuario, bloqueado: nuevoEstado }
        });
    } catch (error) {
        res.status(500).json({ error: 'Error al cambiar estado del usuario' });
    }
});

// ============================================================
// MIGRACIÓN DE DATOS
// ============================================================
async function migrarDatos() {
    console.log('🔄 Verificando datos en Supabase...');
    
    try {
        const servicios = await db.getServicios();
        if (servicios.length === 0) {
            console.log('📦 Creando servicios por defecto...');
            const serviciosPorDefecto = [
                {
                    nombre: 'Masaje Relajante',
                    precio: '$45',
                    descripcion: 'Un masaje suave que alivia el estrés y la tensión muscular.',
                    beneficios: ['Reduce el estrés', 'Alivia tensiones', 'Mejora la circulación'],
                    efectos: ['Relajación profunda', 'Bienestar general'],
                    imagen_web: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800',
                    orden: 1
                },
                {
                    nombre: 'Masaje Deportivo',
                    precio: '$55',
                    descripcion: 'Ideal para atletas y personas activas. Ayuda a la recuperación muscular.',
                    beneficios: ['Recuperación muscular', 'Prevención de lesiones', 'Mejora rendimiento'],
                    efectos: ['Flexibilidad', 'Menos fatiga'],
                    imagen_web: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1.jpg?w=800',
                    orden: 2
                },
                {
                    nombre: 'Masaje con Piedras Calientes',
                    precio: '$65',
                    descripcion: 'Terapia con piedras volcánicas que proporciona calor profundo y relajación total.',
                    beneficios: ['Alivia dolores musculares', 'Mejora la circulación', 'Relajación profunda'],
                    efectos: ['Calor terapéutico', 'Bienestar profundo'],
                    imagen_web: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800',
                    orden: 3
                }
            ];
            for (const s of serviciosPorDefecto) {
                await db.createServicio({ id: generarId(), ...s });
            }
            console.log(`✅ ${serviciosPorDefecto.length} servicios por defecto creados`);
        }
        
        const palabras = await db.getPalabrasBaneadas();
        if (palabras.length === 0) {
            console.log('📦 Cargando palabras baneadas por defecto...');
            const palabrasDefault = [
                'spam', 'porno', 'sexo', 'violencia', 'drogas', 'narcotrafico',
                'terrorismo', 'hack', 'crack', 'pirateria', 'estafa', 'fraude',
                'puta', 'puto', 'zorra', 'cabron', 'pendejo', 'verga', 'ctm', 'maricon',
                'marica', 'culo', 'coño', 'chupar', 'mamada', 'follar', 'joder',
                'mierda', 'estupido', 'imbecil', 'retrasado', 'subnormal',
                'nazi', 'fascista', 'racista', 'homofobico', 'xenofobo'
            ];
            for (const p of palabrasDefault) {
                try { await db.addPalabraBaneada(p); } catch (e) {}
            }
            console.log(`✅ ${palabrasDefault.length} palabras baneadas cargadas`);
        }
        
        const horariosConfig = await db.getHorarios();
        if (!horariosConfig.dias || horariosConfig.dias.length === 0) {
            console.log('📦 Configurando horarios por defecto...');
            await db.setHorarios({
                dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
                horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
                inicio: 8,
                fin: 20
            });
            console.log('✅ Horarios configurados por defecto');
        }
        
        console.log('✅ Migración de datos completada');
    } catch (error) {
        console.error('❌ Error en migración (no crítico):', error.message);
    }
}

// ============================================================
// INICIAR SERVIDOR
// ============================================================
console.log(`🚀 Iniciando servidor en puerto ${PORT}...`);

const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log('🌿 ==========================================');
    console.log(`🌿 Serenity Spa iniciado en puerto ${PORT}`);
    console.log(`📂 Directorio base: ${BASE_DIR}`);
    console.log(`🔐 Modo: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Base de datos: Supabase (Service Role Key)`);
    console.log('🌿 ==========================================');
    
    await migrarDatos();
    
    console.log('✅ Servidor listo para recibir peticiones');
    console.log(`📍 http://localhost:${PORT}`);
});

// Manejar errores del servidor
server.on('error', (error) => {
    console.error('❌ Error en el servidor:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ El puerto ${PORT} ya está en uso`);
        process.exit(1);
    }
});

process.on('SIGTERM', () => {
    console.log('🛑 Recibido SIGTERM, cerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor cerrado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 Recibido SIGINT, cerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor cerrado');
        process.exit(0);
    });
});

module.exports = app;