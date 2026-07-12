// ============================================================
// server.js - SERVIDOR PRINCIPAL CON SUPABASE
// TODOS los endpoints son seguros, SOLO el servidor usa Supabase
// ============================================================

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;
const BASE_DIR = __dirname;

// Importar servicios de Supabase (SOLO SERVIDOR)
const db = require('./supabase-service');

// ============================================================
// VERIFICAR CONFIGURACIÓN DE ENTORNO
// ============================================================
console.log('🔐 ==========================================');
console.log('🔐 VERIFICANDO VARIABLES DE ENTORNO');
console.log('🔐 ==========================================');
console.log('📌 SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Configurada' : '❌ No configurada');
console.log('📌 SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurada' : '❌ No configurada');
console.log('📌 EMAILJS_PUBLIC_KEY:', process.env.EMAILJS_PUBLIC_KEY ? '✅ Configurada' : '❌ No configurada');
console.log('📌 EMAILJS_SERVICE_ID:', process.env.EMAILJS_SERVICE_ID || '❌ No configurado');
console.log('📌 EMAILJS_TEMPLATE_ID:', process.env.EMAILJS_TEMPLATE_ID ? '✅ Configurado' : '❌ No configurado');
console.log('📌 PORT:', process.env.PORT || '5001');
console.log('🔐 ==========================================');

// ============================================================
// MIDDLEWARE
// ============================================================
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

// Filtro de palabras prohibidas
const palabrasProhibidas = [
    'spam', 'porno', 'sexo', 'violencia', 'drogas', 'narcotrafico',
    'terrorismo', 'hack', 'crack', 'pirateria', 'estafa', 'fraude',
    'suicidio', 'muerte', 'asesinato', 'arma', 'bomba', 'explosivo',
    'puta', 'puto', 'zorra', 'cabron', 'pendejo', 'verga', 'ctm', 'maricon',
    'marica', 'culo', 'coño', 'chupar', 'mamada', 'follar', 'joder',
    'mierda', 'estupido', 'imbecil', 'retrasado', 'subnormal',
    'nazi', 'fascista', 'racista', 'homofobico', 'xenofobo'
];

function tienePalabrasProhibidas(texto) {
    if (!texto) return false;
    const textoLower = texto.toLowerCase();
    for (const palabra of palabrasProhibidas) {
        if (textoLower.includes(palabra)) {
            return true;
        }
    }
    return false;
}

// ============================================================
// RUTAS HTML - PÁGINAS ESTÁTICAS
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
// CONFIGURACIÓN EMAILJS (solo datos no sensibles)
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
        
        if (tienePalabrasProhibidas(nombre)) {
            return res.status(400).json({ 
                error: 'El nombre contiene palabras inapropiadas. Por favor, usa un nombre válido.' 
            });
        }
        
        const emailUsername = email.split('@')[0];
        if (tienePalabrasProhibidas(emailUsername)) {
            return res.status(400).json({ 
                error: 'El correo contiene palabras inapropiadas. Por favor, usa un correo válido.' 
            });
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
// WHATSAPP - ENVÍO DE CÓDIGO DE VERIFICACIÓN (REGISTRO)
// ============================================================
app.post('/api/enviar-whatsapp-verificacion', async (req, res) => {
    try {
        const { telefono, codigo } = req.body;
        
        if (!telefono || !codigo) {
            return res.status(400).json({ error: 'Teléfono y código son requeridos' });
        }
        
        const telefonoLimpio = telefono.replace(/\D/g, '');
        if (telefonoLimpio.length < 7) {
            return res.status(400).json({ error: 'Teléfono inválido' });
        }
        
        const mensaje = `🌿 *SERENITY SPA*

🔐 Código de verificación: *${codigo}*

⏱️ Este código expira en 3 minutos.

¡Bienvenido a Serenity Spa! ✨`;
        
        const numero = `53${telefonoLimpio}`;
        const whatsappUrl = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
        
        res.json({ 
            success: true, 
            url: whatsappUrl,
            mensaje: mensaje,
            telefono: numero
        });
    } catch (error) {
        console.error('❌ Error enviando WhatsApp:', error);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
});





// ============================================================
// TESTIMONIOS - CORREGIDO
// ============================================================
app.get('/api/testimonios', async (req, res) => {
    try {
        const testimonios = await db.getTestimonios(true);
        console.log(`📝 Enviando ${testimonios.length} testimonios públicos`);
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
        
        if (tienePalabrasProhibidas(comentario) || tienePalabrasProhibidas(nombre)) {
            return res.status(400).json({ 
                error: 'El comentario contiene palabras inapropiadas. Por favor, edítalo.' 
            });
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
        
        if (tienePalabrasProhibidas(nombre)) {
            return res.status(400).json({ error: 'El nombre contiene palabras inapropiadas.' });
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
        
        const codigoCancelacion = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const nuevoTurno = {
            id: generarId(),
            nombre: escapeHtml(nombre.trim()),
            dia: diaLower,
            fecha: fechaTurno,
            hora: horaNumerica,
            massage_type: massageType,
            telefono: telefono.replace(/\D/g, ''),
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
// WHATSAPP (Admin)
// ============================================================
app.post('/api/enviar-whatsapp/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const turno = await db.getTurnoById(id);
        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        let imagenWhatsApp = 'https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg';
        try {
            const servicios = await db.getServicios();
            const servicio = servicios.find(s => s.nombre === turno.massage_type);
            if (servicio && servicio.imagen_whatsapp) {
                imagenWhatsApp = servicio.imagen_whatsapp;
            }
        } catch (e) {}
        
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
// BLOQUEO DE IP - DESDE TURNOS
// ============================================================
app.post('/api/seguridad/bloquear-usuario/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        
        // Obtener el turno
        const turno = await db.getTurnoById(id);
        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        const ip = turno.ip || 'IP desconocida';
        if (ip === 'IP desconocida' || ip === 'N/A') {
            return res.status(400).json({ error: 'No se puede bloquear: IP desconocida' });
        }
        
        // Obtener conteo actual de bloqueos para esta IP
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
        
        // Guardar bloqueo en Supabase
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
        
        // Insertar en la tabla bloqueos usando supabase
        const { error } = await db.supabase
            .from('bloqueos')
            .insert([bloqueo]);
        
        if (error) {
            console.error('Error guardando bloqueo:', error);
            return res.status(500).json({ error: 'Error al guardar bloqueo' });
        }
        
        // Actualizar conteo en el turno
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

// ============================================================
// BLOQUEOS ACTIVOS
// ============================================================
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

// ============================================================
// CONFIGURACIÓN REGISTRO
// ============================================================
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
        res.json({ 
            dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'], 
            horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
            inicio: 8,
            fin: 20
        });
    }
});




// server.js - Endpoint de horarios (ya está correcto)
app.put('/api/config/horarios', verifyAuth, async (req, res) => {
    try {
        const data = req.body;
        
        if (!data.dias || !Array.isArray(data.dias)) {
            data.dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        }
        if (!data.horarios || !Array.isArray(data.horarios)) {
            data.horarios = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
        }
        if (data.inicio === undefined) data.inicio = 8;
        if (data.fin === undefined) data.fin = 20;
        
        await db.setHorarios(data);
        res.json({ success: true, data: data });
    } catch (e) {
        console.error('❌ Error guardando horarios:', e);
        res.status(500).json({ error: 'Error al guardar horarios' });
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
let palabrasBaneadasCache = [];

async function cargarPalabrasBaneadas() {
    try {
        palabrasBaneadasCache = await db.getPalabrasBaneadas();
        console.log(`📋 Palabras baneadas cargadas: ${palabrasBaneadasCache.length}`);
    } catch (e) {
        console.warn('⚠️ Error cargando palabras baneadas:', e);
        palabrasBaneadasCache = [];
    }
}

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
        
        await cargarPalabrasBaneadas();
        
        const palabras = await db.getPalabrasBaneadas();
        res.json({ success: true, palabras });
    } catch (e) {
        console.error('❌ Error modificando palabras baneadas:', e);
        res.status(500).json({ error: 'Error al modificar palabras baneadas' });
    }
});

// ============================================================
// SERVICIOS - CRUD COMPLETO CON IMÁGENES
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
        
        let imagenWebFinal = imagenWeb || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800";
        let imagenWhatsAppFinal = imagenWhatsApp || '';
        
        const nuevoServicio = {
            id: generarId(),
            nombre: nombre.trim(),
            precio: precio.trim(),
            descripcion: descripcion.trim(),
            beneficios: beneficios || [],
            efectos: efectos || [],
            imagen_web: imagenWebFinal,
            imagen_whatsapp: imagenWhatsAppFinal,
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
        
        let imagenWebFinal = imagenWeb || servicioExistente.imagen_web || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800";
        let imagenWhatsAppFinal = imagenWhatsApp || servicioExistente.imagen_whatsapp || '';
        
        const servicioActualizado = {
            nombre: nombre.trim(),
            precio: precio.trim(),
            descripcion: descripcion.trim(),
            beneficios: beneficios || [],
            efectos: efectos || [],
            imagen_web: imagenWebFinal,
            imagen_whatsapp: imagenWhatsAppFinal,
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
// ADMIN - GESTIÓN DE USUARIOS
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
// MIGRACIÓN DE DATOS DESDE JSON
// ============================================================
async function migrarDatos() {
    console.log('🔄 Verificando datos en Supabase...');
    
    try {
        const servicios = await db.getServicios();
        if (servicios.length === 0) {
            console.log('📦 Migrando servicios...');
            try {
                const serviciosData = JSON.parse(await fs.readFile(path.join(BASE_DIR, 'servicios.json'), 'utf8'));
                for (const s of serviciosData) {
                    await db.createServicio({
                        id: s.id || generarId(),
                        nombre: s.nombre,
                        precio: s.precio,
                        descripcion: s.descripcion,
                        beneficios: s.beneficios || [],
                        efectos: s.efectos || [],
                        imagen_web: s.imagenWeb || s.imagen_web || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
                        imagen_whatsapp: s.imagenWhatsApp || s.imagen_whatsapp || '',
                        video_url: s.videoUrl || s.video_url || '',
                        orden: s.orden || 0
                    });
                }
                console.log(`✅ ${serviciosData.length} servicios migrados`);
            } catch (e) {
                console.log('ℹ️ No hay servicios JSON para migrar');
            }
        }
        
        const testimonios = await db.getTestimonios(false);
        if (testimonios.length === 0) {
            console.log('📦 Migrando testimonios...');
            try {
                const testimoniosData = JSON.parse(await fs.readFile(path.join(BASE_DIR, 'testimonios.json'), 'utf8'));
                for (const t of testimoniosData) {
                    await db.createTestimonio({
                        id: t.id || generarId(),
                        nombre: t.nombre,
                        calificacion: t.calificacion,
                        comentario: t.comentario,
                        imagen: t.imagen || null,
                        publico: t.publico !== false,
                        fecha: t.fecha || new Date().toISOString()
                    });
                }
                console.log(`✅ ${testimoniosData.length} testimonios migrados`);
            } catch (e) {
                console.log('ℹ️ No hay testimonios JSON para migrar');
            }
        }
        
        const palabras = await db.getPalabrasBaneadas();
        if (palabras.length === 0) {
            console.log('📦 Cargando palabras baneadas por defecto...');
            const palabrasDefault = [
                'spam', 'porno', 'sexo', 'violencia', 'drogas', 'narcotrafico',
                'terrorismo', 'hack', 'crack', 'pirateria', 'estafa', 'fraude',
                'suicidio', 'muerte', 'asesinato', 'arma', 'bomba', 'explosivo',
                'puta', 'puto', 'zorra', 'cabron', 'pendejo', 'verga', 'ctm', 'maricon',
                'marica', 'culo', 'coño', 'chupar', 'mamada', 'follar', 'joder',
                'mierda', 'estupido', 'imbecil', 'retrasado', 'subnormal',
                'nazi', 'fascista', 'racista', 'homofobico', 'xenofobo'
            ];
            for (const p of palabrasDefault) {
                try {
                    await db.addPalabraBaneada(p);
                } catch (e) {}
            }
            console.log(`✅ ${palabrasDefault.length} palabras baneadas cargadas`);
        }
        
        await cargarPalabrasBaneadas();
        
        console.log('✅ Migración de datos completada');
    } catch (error) {
        console.error('❌ Error en migración:', error);
    }
}

// ============================================================
// INICIAR SERVIDOR
// ============================================================
const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log('🌿 ==========================================');
    console.log(`🌿 Serenity Spa iniciado en puerto ${PORT}`);
    console.log(`📂 Directorio base: ${BASE_DIR}`);
    console.log(`🔐 Modo: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Base de datos: Supabase (Service Role Key)`);
    console.log('🌿 ==========================================');
    
    await migrarDatos();
    
    console.log('✅ Servidor listo para recibir peticiones');
});

process.on('SIGTERM', () => {
    console.log('🛑 Recibido SIGTERM, cerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor cerrado');
        process.exit(0);
    });
});