// server.js - Versión con Supabase
const express = require('express');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();
const supabase = require('./supabaseClient');

const app = express();
const PORT = process.env.PORT || 5001;
const BASE_DIR = __dirname;

// ============================================================
// VERIFICAR CONFIGURACIÓN DE ENTORNO
// ============================================================
console.log('🔐 ==========================================');
console.log('🔐 VERIFICANDO VARIABLES DE ENTORNO');
console.log('🔐 ==========================================');
console.log('📌 SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Configurada' : '❌ No configurada');
console.log('📌 SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ No configurada');
console.log('📌 EMAILJS_PUBLIC_KEY:', process.env.EMAILJS_PUBLIC_KEY ? '✅ Configurada' : '❌ No configurada');
console.log('📌 EMAILJS_SERVICE_ID:', process.env.EMAILJS_SERVICE_ID || '❌ No configurado');
console.log('📌 EMAILJS_TEMPLATE_ID:', process.env.EMAILJS_TEMPLATE_ID ? '✅ Configurado' : '❌ No configurado');
console.log('📌 PORT:', process.env.PORT || '5001');
console.log('🔐 ==========================================');

// ============================================================
// MIDDLEWARES
// ============================================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(BASE_DIR));

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
// 🔐 AUTENTICACIÓN ADMIN
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
        res.status(500).json({ success: false, mensaje: 'Error interno del servidor' });
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
// 🧑 USUARIOS - REGISTRO Y VERIFICACIÓN
// ============================================================

// Guardar código de verificación
app.post('/api/registro/guardar-codigo', async (req, res) => {
    try {
        const { email, nombre, codigo } = req.body;
        
        // Verificar si el email ya existe y está verificado
        const { data: usuarioExistente } = await supabase
            .from('usuarios')
            .select('email, verificado')
            .eq('email', email)
            .single();
        
        if (usuarioExistente && usuarioExistente.verificado) {
            return res.status(400).json({ error: 'Este email ya está registrado y verificado.' });
        }
        
        const expiracion = Date.now() + 3 * 60 * 1000;
        
        // Guardar o actualizar código
        const { error } = await supabase
            .from('codigos_verificacion')
            .upsert({
                email,
                codigo,
                expiracion,
                intentos: 0,
                nombre
            }, { onConflict: 'email' });
        
        if (error) throw error;
        
        console.log(`✅ Código guardado para ${email}: ${codigo}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error guardando código:', error);
        res.status(500).json({ error: 'Error al guardar código' });
    }
});

// Verificar código
app.post('/api/registro/verificar-codigo', async (req, res) => {
    try {
        const { email, codigo } = req.body;
        
        if (!email || !codigo) {
            return res.status(400).json({ error: 'Email y código son requeridos' });
        }
        
        // Obtener el registro de verificación
        const { data: registro, error: fetchError } = await supabase
            .from('codigos_verificacion')
            .select('*')
            .eq('email', email)
            .single();
        
        if (fetchError || !registro) {
            return res.status(400).json({ error: 'Código inválido o expirado.' });
        }
        
        // Verificar expiración
        if (Date.now() > registro.expiracion) {
            await supabase.from('codigos_verificacion').delete().eq('email', email);
            return res.status(400).json({ error: 'El código ha expirado.' });
        }
        
        // Verificar intentos
        if (registro.intentos >= 5) {
            await supabase.from('codigos_verificacion').delete().eq('email', email);
            return res.status(400).json({ error: 'Demasiados intentos.' });
        }
        
        // Verificar código
        if (registro.codigo !== codigo) {
            await supabase
                .from('codigos_verificacion')
                .update({ intentos: (registro.intentos || 0) + 1 })
                .eq('email', email);
            return res.status(400).json({ error: `Código incorrecto. Te quedan ${5 - (registro.intentos + 1)} intentos.` });
        }
        
        // Verificar si el usuario ya existe
        const { data: usuarioExistente } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .single();
        
        let usuario;
        if (usuarioExistente) {
            if (usuarioExistente.verificado) {
                return res.status(400).json({ error: 'Este email ya está registrado.' });
            }
            // Actualizar usuario existente
            const { data: updated, error: updateError } = await supabase
                .from('usuarios')
                .update({
                    nombre: registro.nombre,
                    verificado: true,
                    fecha_registro: new Date().toISOString()
                })
                .eq('email', email)
                .select()
                .single();
            
            if (updateError) throw updateError;
            usuario = updated;
        } else {
            // Crear nuevo usuario
            const nuevoUsuario = {
                id: generarId(),
                nombre: registro.nombre,
                email: email,
                verificado: true,
                bloqueado: false,
                motivo_bloqueo: null,
                avatar: null,
                fecha_registro: new Date().toISOString()
            };
            
            const { data: created, error: insertError } = await supabase
                .from('usuarios')
                .insert(nuevoUsuario)
                .select()
                .single();
            
            if (insertError) throw insertError;
            usuario = created;
        }
        
        // Eliminar código de verificación
        await supabase.from('codigos_verificacion').delete().eq('email', email);
        
        // Crear token de sesión
        const token = crypto.randomBytes(64).toString('hex');
        const { error: tokenError } = await supabase
            .from('tokens_usuario')
            .insert({ token, email });
        
        if (tokenError) throw tokenError;
        
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

// Verificar token de usuario
app.get('/api/verify/user', async (req, res) => {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) {
        return res.json({ valid: false });
    }
    const token = h.substring(7);
    
    try {
        const { data, error } = await supabase
            .from('tokens_usuario')
            .select('email')
            .eq('token', token)
            .single();
        
        if (error || !data) {
            return res.json({ valid: false });
        }
        res.json({ valid: true });
    } catch (e) {
        res.json({ valid: false });
    }
});

// ============================================================
// 🗣️ TESTIMONIOS
// ============================================================

// GET - Testimonios públicos
app.get('/api/testimonios', async (req, res) => {
    try {
        const { data: testimonios, error } = await supabase
            .from('testimonios')
            .select('*')
            .eq('publico', true)
            .order('fecha', { ascending: false });
        
        if (error) throw error;
        res.json(testimonios || []);
    } catch (error) {
        console.error('Error cargando testimonios:', error);
        res.json([]);
    }
});

// POST - Guardar testimonio
app.post('/api/testimonios', async (req, res) => {
    try {
        const { nombre, calificacion, comentario, imagen, publico } = req.body;
        
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
        
        const { data, error } = await supabase
            .from('testimonios')
            .insert(testimonio)
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json({ success: true, testimonio: data });
    } catch (error) {
        console.error('Error guardando testimonio:', error);
        res.status(500).json({ error: 'Error al guardar el testimonio' });
    }
});

// GET - Todos los testimonios (admin)
app.get('/api/admin/testimonios', verifyAuth, async (req, res) => {
    try {
        const { data: testimonios, error } = await supabase
            .from('testimonios')
            .select('*')
            .order('fecha', { ascending: false });
        
        if (error) throw error;
        res.json(testimonios || []);
    } catch (error) {
        console.error('Error cargando testimonios admin:', error);
        res.status(500).json({ error: 'Error al cargar testimonios' });
    }
});

// DELETE - Eliminar testimonio (admin)
app.delete('/api/admin/testimonios/:id', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('testimonios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando testimonio:', error);
        res.status(500).json({ error: 'Error al eliminar testimonio' });
    }
});

// PUT - Cambiar estado público (admin)
app.put('/api/admin/testimonios/:id/publico', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { publico } = req.body;
        
        const { data, error } = await supabase
            .from('testimonios')
            .update({ publico: publico === true })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        res.json({ success: true, testimonio: data });
    } catch (error) {
        console.error('Error actualizando testimonio:', error);
        res.status(500).json({ error: 'Error al actualizar testimonio' });
    }
});

// ============================================================
// 📅 TURNOS
// ============================================================

// GET - Todos los turnos
app.get('/turnos', async (req, res) => {
    try {
        const { data: turnos, error } = await supabase
            .from('turnos')
            .select('*')
            .order('fecha_creacion', { ascending: false });
        
        if (error) throw error;
        res.json(turnos || []);
    } catch (error) {
        console.error('Error cargando turnos:', error);
        res.json([]);
    }
});

// POST - Crear turno
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
        
        // Verificar si el horario está ocupado
        const { data: ocupados, error: ocupError } = await supabase
            .from('turnos')
            .select('id')
            .eq('dia', dia.toLowerCase())
            .eq('fecha', fecha || new Date().toISOString().split('T')[0])
            .eq('hora', horaNumerica);
        
        if (ocupError) throw ocupError;
        
        if (ocupados && ocupados.length > 0) {
            return res.status(409).json({ error: 'Horario ocupado' });
        }
        
        const codigoCancelacion = Math.random().toString(36).substring(2, 8).toUpperCase();
        const ubicacionSalonGlobal = 'Salón Serenity Spa';
        
        const nuevoTurno = {
            id: generarId(),
            nombre: escapeHtml(nombre.trim()),
            dia: dia.toLowerCase(),
            fecha: fecha || new Date().toISOString().split('T')[0],
            hora: horaNumerica,
            massage_type: massageType,
            telefono: telefono.replace(/\D/g, ''),
            codigo_pais: codigoPais || '53',
            ubicacion: ubicacion || ubicacionSalonGlobal,
            tipo_servicio: tipoServicio || 'salon',
            confirmado_whatsapp: false,
            fecha_creacion: new Date().toISOString(),
            codigo_cancelacion: codigoCancelacion,
            ip: ip || req.ip || 'N/A',
            conteo_bloqueos: 0
        };
        
        const { data, error } = await supabase
            .from('turnos')
            .insert(nuevoTurno)
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json({
            mensaje: 'Turno reservado exitosamente',
            turno: data,
            codigoCancelacion: codigoCancelacion
        });
    } catch (error) {
        console.error('Error creando turno:', error);
        res.status(500).json({ error: 'Error al crear el turno' });
    }
});

// DELETE - Eliminar turno (admin)
app.delete('/turnos/:id', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('turnos')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando turno:', error);
        res.status(500).json({ error: 'Error al eliminar turno' });
    }
});

// POST - Bloquear IP de usuario
app.post('/api/seguridad/bloquear-usuario/:id', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: turno, error: fetchError } = await supabase
            .from('turnos')
            .select('ip, nombre, conteo_bloqueos')
            .eq('id', id)
            .single();
        
        if (fetchError || !turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        const conteo = (turno.conteo_bloqueos || 0) + 1;
        
        const { error: updateError } = await supabase
            .from('turnos')
            .update({ conteo_bloqueos: conteo })
            .eq('id', id);
        
        if (updateError) throw updateError;
        
        res.json({
            success: true,
            ip: turno.ip || 'IP desconocida',
            conteo: conteo,
            mensaje: `IP ${turno.ip || 'desconocida'} bloqueada (${conteo}ra vez)`
        });
    } catch (error) {
        console.error('Error bloqueando IP:', error);
        res.status(500).json({ error: 'Error al bloquear IP' });
    }
});

// ============================================================
// 📊 HORARIOS DISPONIBLES
// ============================================================
app.get('/api/horarios-disponibles', async (req, res) => {
    try {
        const { fecha, dia, modalidad } = req.query;
        
        if (!fecha || !dia) {
            return res.status(400).json({ error: 'Fecha y día son requeridos' });
        }
        
        // Obtener horarios
        const { data: horariosData, error: horariosError } = await supabase
            .from('horarios')
            .select('*')
            .order('id', { ascending: false })
            .limit(1);
        
        if (horariosError) throw horariosError;
        
        const horariosConfig = horariosData && horariosData.length > 0 ? horariosData[0] : {
            dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
            horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
            inicio: 8,
            fin: 20
        };
        
        const diaLower = dia.toLowerCase();
        const diasLaborales = horariosConfig.dias || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        
        if (!diasLaborales.includes(diaLower)) {
            return res.json({ disponibles: [], mensaje: 'Día no laboral', esLaboral: false });
        }
        
        // Obtener modalidades
        const { data: modalidadesData, error: modalError } = await supabase
            .from('modalidades')
            .select('*')
            .order('id', { ascending: false })
            .limit(1);
        
        if (modalError) throw modalError;
        
        const modalidadesConfig = modalidadesData && modalidadesData.length > 0 ? modalidadesData[0] : {
            salon_activo: true,
            domicilio_activo: true
        };
        
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
        
        // Obtener turnos ocupados
        const { data: ocupados, error: ocupError } = await supabase
            .from('turnos')
            .select('hora')
            .eq('fecha', fecha)
            .eq('dia', diaLower);
        
        if (ocupError) throw ocupError;
        
        const ocupadas = ocupados ? ocupados.map(t => t.hora) : [];
        
        const disponibles = [];
        const inicio = horariosConfig.inicio || 8;
        const fin = horariosConfig.fin || 20;
        
        for (let h = inicio; h < fin; h += intervaloHoras) {
            if (!ocupadas.includes(h)) {
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
            diasLaborales: diasLaborales,
            esLaboral: true,
            salonActivo: modalidadesConfig.salon_activo !== false,
            domicilioActivo: modalidadesConfig.domicilio_activo !== false
        });
    } catch (error) {
        console.error('Error calculando horarios:', error);
        res.status(500).json({ error: 'Error al calcular horarios disponibles' });
    }
});

// ============================================================
// 🏷️ SERVICIOS
// ============================================================

// GET - Todos los servicios
app.get('/api/servicios', async (req, res) => {
    try {
        const { data: servicios, error } = await supabase
            .from('servicios')
            .select('*')
            .order('orden', { ascending: true });
        
        if (error) throw error;
        res.json(servicios || []);
    } catch (error) {
        console.error('Error cargando servicios:', error);
        res.status(500).json({ error: 'Error al obtener servicios' });
    }
});

// POST - Crear servicio (admin)
app.post('/api/servicios', verifyAuth, async (req, res) => {
    try {
        const { nombre, precio, descripcion, beneficios, efectos, imagenWeb, imagenWhatsApp, videoUrl } = req.body;
        
        if (!nombre || !precio || !descripcion) {
            return res.status(400).json({ error: 'Nombre, precio y descripción son obligatorios' });
        }
        
        // Obtener el último orden
        const { data: servicios, error: fetchError } = await supabase
            .from('servicios')
            .select('orden')
            .order('orden', { ascending: false })
            .limit(1);
        
        if (fetchError) throw fetchError;
        
        const ultimoOrden = servicios && servicios.length > 0 ? servicios[0].orden : 0;
        
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
            orden: ultimoOrden + 1
        };
        
        const { data, error } = await supabase
            .from('servicios')
            .insert(nuevoServicio)
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creando servicio:', error);
        res.status(500).json({ error: 'Error al crear el servicio' });
    }
});

// PUT - Actualizar servicio (admin)
app.put('/api/servicios/:id', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, precio, descripcion, beneficios, efectos, imagenWeb, imagenWhatsApp, videoUrl } = req.body;
        
        if (!nombre || !precio || !descripcion) {
            return res.status(400).json({ error: 'Nombre, precio y descripción son obligatorios' });
        }
        
        const { data, error } = await supabase
            .from('servicios')
            .update({
                nombre: nombre.trim(),
                precio: precio.trim(),
                descripcion: descripcion.trim(),
                beneficios: beneficios || [],
                efectos: efectos || [],
                imagen_web: imagenWeb || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
                imagen_whatsapp: imagenWhatsApp || '',
                video_url: videoUrl || ''
            })
            .eq('id', id)
            .select()
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Servicio no encontrado' });
            }
            throw error;
        }
        
        res.json(data);
    } catch (error) {
        console.error('Error actualizando servicio:', error);
        res.status(500).json({ error: 'Error al actualizar el servicio' });
    }
});

// DELETE - Eliminar servicio (admin)
app.delete('/api/servicios/:id', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('servicios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando servicio:', error);
        res.status(500).json({ error: 'Error al eliminar el servicio' });
    }
});

// ============================================================
// 👥 USUARIOS (admin)
// ============================================================

app.get('/api/usuarios', verifyAuth, async (req, res) => {
    try {
        const { data: usuarios, error } = await supabase
            .from('usuarios')
            .select('*')
            .order('fecha_registro', { ascending: false });
        
        if (error) throw error;
        res.json(usuarios || []);
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        res.status(500).json({ error: 'Error al cargar usuarios' });
    }
});

app.delete('/api/usuarios/:id', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('usuarios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

app.put('/api/usuarios/:id/bloquear', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        
        const { data: usuario, error: fetchError } = await supabase
            .from('usuarios')
            .select('bloqueado')
            .eq('id', id)
            .single();
        
        if (fetchError) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        const nuevoEstado = !usuario.bloqueado;
        const { data, error } = await supabase
            .from('usuarios')
            .update({
                bloqueado: nuevoEstado,
                motivo_bloqueo: nuevoEstado ? (motivo || 'Bloqueado por admin') : null
            })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json({
            success: true,
            message: `Usuario ${nuevoEstado ? 'bloqueado' : 'desbloqueado'}`,
            usuario: data
        });
    } catch (error) {
        console.error('Error cambiando estado del usuario:', error);
        res.status(500).json({ error: 'Error al cambiar estado del usuario' });
    }
});

// ============================================================
// ⚙️ CONFIGURACIÓN
// ============================================================

// Helper para obtener configuración
async function getConfig(clave, defaultValue = null) {
    try {
        const { data, error } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', clave)
            .single();
        
        if (error || !data) return defaultValue;
        return data.valor;
    } catch (e) {
        return defaultValue;
    }
}

// Helper para guardar configuración
async function setConfig(clave, valor) {
    try {
        const { error } = await supabase
            .from('configuracion')
            .upsert({ clave, valor }, { onConflict: 'clave' });
        
        if (error) throw error;
        return true;
    } catch (e) {
        console.error(`Error guardando config ${clave}:`, e);
        return false;
    }
}

app.get('/api/config', async (req, res) => {
    try {
        const config = await getConfig('general', {});
        res.json(config);
    } catch (e) {
        res.json({});
    }
});

app.put('/api/config', verifyAuth, async (req, res) => {
    try {
        await setConfig('general', req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar configuración' });
    }
});

app.get('/api/config/registro', async (req, res) => {
    try {
        const config = await getConfig('registro', {});
        res.json(config);
    } catch (e) {
        res.json({});
    }
});

app.put('/api/config/registro', verifyAuth, async (req, res) => {
    try {
        await setConfig('registro', req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al guardar configuración de registro' });
    }
});

// ============================================================
// 🕐 HORARIOS
// ============================================================

app.get('/api/config/horarios', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('horarios')
            .select('*')
            .order('id', { ascending: false })
            .limit(1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            const config = data[0];
            res.json({
                dias: config.dias || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
                horarios: config.horarios || ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
                inicio: config.inicio || 8,
                fin: config.fin || 20
            });
        } else {
            res.json({
                dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
                horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
                inicio: 8,
                fin: 20
            });
        }
    } catch (e) {
        console.warn('Error leyendo horarios:', e);
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
        
        // Asegurar que días sea un array
        if (!data.dias || !Array.isArray(data.dias)) {
            data.dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        }
        if (!data.horarios || !Array.isArray(data.horarios)) {
            data.horarios = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
        }
        if (data.inicio === undefined) data.inicio = 8;
        if (data.fin === undefined) data.fin = 20;
        
        // Eliminar horarios existentes y crear uno nuevo
        await supabase.from('horarios').delete().neq('id', 0);
        
        const { error } = await supabase
            .from('horarios')
            .insert({
                dias: data.dias,
                horarios: data.horarios,
                inicio: data.inicio,
                fin: data.fin,
                actualizado: new Date().toISOString()
            });
        
        if (error) throw error;
        
        res.json({ success: true, data });
    } catch (e) {
        console.error('Error guardando horarios:', e);
        res.status(500).json({ error: 'Error al guardar horarios' });
    }
});

// ============================================================
// 🏠 MODALIDADES
// ============================================================

app.get('/api/config/modalidades', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('modalidades')
            .select('*')
            .order('id', { ascending: false })
            .limit(1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            res.json({
                salon: { activo: data[0].salon_activo !== false },
                domicilio: { activo: data[0].domicilio_activo !== false }
            });
        } else {
            res.json({ salon: { activo: true }, domicilio: { activo: true } });
        }
    } catch (e) {
        res.json({ salon: { activo: true }, domicilio: { activo: true } });
    }
});

app.put('/api/config/modalidades', verifyAuth, async (req, res) => {
    try {
        const { salon, domicilio } = req.body;
        
        await supabase.from('modalidades').delete().neq('id', 0);
        
        const { error } = await supabase
            .from('modalidades')
            .insert({
                salon_activo: salon?.activo !== false,
                domicilio_activo: domicilio?.activo !== false,
                actualizado: new Date().toISOString()
            });
        
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('Error guardando modalidades:', e);
        res.status(500).json({ error: 'Error al guardar modalidades' });
    }
});

// ============================================================
// 🔒 SEGURIDAD - PAÍSES
// ============================================================

app.get('/api/seguridad/paises', async (req, res) => {
    try {
        const { data: paises, error } = await supabase
            .from('paises')
            .select('*')
            .order('codigo');
        
        if (error) throw error;
        
        const autorizados = paises ? paises.filter(p => p.autorizado).map(p => p.codigo) : [];
        const bloqueados = paises ? paises.filter(p => p.bloqueado).map(p => p.codigo) : [];
        const ubicacionSalon = await getConfig('ubicacion_salon', 'Salón Serenity Spa');
        
        res.json({
            autorizados,
            bloqueados,
            modo: await getConfig('modo_paises', 'todos'),
            ubicacionSalon
        });
    } catch (e) {
        res.json({ autorizados: [], bloqueados: [], modo: 'todos', ubicacionSalon: 'Salón Serenity Spa' });
    }
});

app.put('/api/seguridad/paises', verifyAuth, async (req, res) => {
    try {
        const { autorizados, bloqueados, modo, ubicacionSalon } = req.body;
        
        // Limpiar tabla y recargar
        await supabase.from('paises').delete().neq('id', 0);
        
        const paisesData = [];
        if (autorizados && Array.isArray(autorizados)) {
            autorizados.forEach(codigo => {
                paisesData.push({ codigo, autorizado: true, bloqueado: false });
            });
        }
        if (bloqueados && Array.isArray(bloqueados)) {
            bloqueados.forEach(codigo => {
                if (!paisesData.some(p => p.codigo === codigo)) {
                    paisesData.push({ codigo, autorizado: false, bloqueado: true });
                }
            });
        }
        
        if (paisesData.length > 0) {
            const { error } = await supabase.from('paises').insert(paisesData);
            if (error) throw error;
        }
        
        if (modo) await setConfig('modo_paises', modo);
        if (ubicacionSalon) await setConfig('ubicacion_salon', ubicacionSalon);
        
        res.json({ success: true });
    } catch (e) {
        console.error('Error guardando países:', e);
        res.status(500).json({ error: 'Error al guardar países' });
    }
});

// ============================================================
// 🚫 PALABRAS BANEADAS
// ============================================================

app.get('/api/palabras-baneadas', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('palabras_baneadas')
            .select('palabra');
        
        if (error) throw error;
        res.json({ palabras: data ? data.map(p => p.palabra) : [] });
    } catch (e) {
        res.json({ palabras: [] });
    }
});

app.post('/api/palabras-baneadas', verifyAuth, async (req, res) => {
    try {
        const { palabra, accion } = req.body;
        
        if (accion === 'agregar') {
            const { error } = await supabase
                .from('palabras_baneadas')
                .insert({ palabra })
                .select();
            
            if (error && error.code !== '23505') { // 23505 = duplicate key
                throw error;
            }
        } else if (accion === 'eliminar') {
            const { error } = await supabase
                .from('palabras_baneadas')
                .delete()
                .eq('palabra', palabra);
            
            if (error) throw error;
        }
        
        // Obtener lista actualizada
        const { data, error } = await supabase
            .from('palabras_baneadas')
            .select('palabra');
        
        if (error) throw error;
        res.json({ success: true, palabras: data ? data.map(p => p.palabra) : [] });
    } catch (e) {
        console.error('Error modificando palabras baneadas:', e);
        res.status(500).json({ error: 'Error al modificar palabras baneadas' });
    }
});

// ============================================================
// 🤖 IA - PERSONALIDAD
// ============================================================

app.get('/api/ia/personalidad', async (req, res) => {
    try {
        const config = await getConfig('ia_personalidad', {
            nombre: 'Asistente Serenity',
            tono: 'cálido y profesional',
            estilo: '',
            reglas: []
        });
        res.json(config);
    } catch (e) {
        res.json({ nombre: 'Asistente Serenity', tono: 'cálido y profesional', estilo: '', reglas: [] });
    }
});

app.put('/api/ia/personalidad', verifyAuth, async (req, res) => {
    try {
        await setConfig('ia_personalidad', req.body);
        res.json({ success: true, data: req.body });
    } catch (e) {
        console.error('Error guardando personalidad IA:', e);
        res.status(500).json({ error: 'Error al guardar' });
    }
});

app.post('/api/ia/recargar', verifyAuth, async (req, res) => {
    try {
        const { count } = await supabase.from('servicios').select('*', { count: 'exact', head: true });
        const config = await getConfig('ia_personalidad', {});
        res.json({
            success: true,
            items: count || 0,
            recargaInfo: {
                ultimaRecarga: new Date().toISOString(),
                items: count || 0,
                configuracion: config
            }
        });
    } catch (e) {
        res.status(500).json({ error: 'Error al recargar conocimiento' });
    }
});

// ============================================================
// 🔐 SEGURIDAD - BLOQUEOS
// ============================================================

app.get('/api/seguridad/bloqueos', verifyAuth, async (req, res) => {
    try {
        const { data: bloqueos, error } = await supabase
            .from('bloqueos_seguridad')
            .select('*')
            .order('fecha_bloqueo', { ascending: false });
        
        if (error) throw error;
        
        const activos = bloqueos ? bloqueos.filter(b => b.permanente || (b.expiracion && b.expiracion > Date.now())) : [];
        const historial = bloqueos || [];
        const intentosFallidos = {}; // Se puede implementar con otra tabla si es necesario
        
        res.json({ activos, historial, intentosFallidos });
    } catch (e) {
        res.json({ activos: [], historial: [], intentosFallidos: {} });
    }
});

app.post('/api/seguridad/desbloquear/:ip', verifyAuth, async (req, res) => {
    try {
        const { ip } = req.params;
        const { error } = await supabase
            .from('bloqueos_seguridad')
            .delete()
            .eq('ip', ip);
        
        if (error) throw error;
        res.json({ ok: true, mensaje: 'IP desbloqueada' });
    } catch (e) {
        res.status(500).json({ error: 'Error al desbloquear IP' });
    }
});

app.delete('/api/seguridad/bloqueos/:ip', verifyAuth, async (req, res) => {
    try {
        const { ip } = req.params;
        const { error } = await supabase
            .from('bloqueos_seguridad')
            .delete()
            .eq('ip', ip);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error al eliminar bloqueo' });
    }
});

app.post('/api/seguridad/limpiar-expirados', verifyAuth, async (req, res) => {
    try {
        const ahora = Date.now();
        const { error } = await supabase
            .from('bloqueos_seguridad')
            .delete()
            .eq('permanente', false)
            .lt('expiracion', ahora);
        
        if (error) throw error;
        res.json({ mensaje: 'Bloqueos expirados eliminados' });
    } catch (e) {
        res.status(500).json({ error: 'Error' });
    }
});

app.post('/api/seguridad/limpiar-todo', verifyAuth, async (req, res) => {
    try {
        const { error } = await supabase
            .from('bloqueos_seguridad')
            .delete()
            .neq('id', 0);
        
        if (error) throw error;
        res.json({ mensaje: 'Todos los bloqueos eliminados' });
    } catch (e) {
        res.status(500).json({ error: 'Error' });
    }
});

app.delete('/api/seguridad/historial/:id', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('bloqueos_seguridad')
            .delete()
            .eq('id', parseInt(id));
        
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error' });
    }
});

// ============================================================
// 📱 WHATSAPP
// ============================================================

app.post('/api/enviar-whatsapp/:id', verifyAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: turno, error } = await supabase
            .from('turnos')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error || !turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        // Obtener imagen del servicio
        let imagenWhatsApp = 'https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg';
        const { data: servicios, error: servError } = await supabase
            .from('servicios')
            .select('imagen_whatsapp')
            .eq('nombre', turno.massage_type)
            .limit(1);
        
        if (!servError && servicios && servicios.length > 0 && servicios[0].imagen_whatsapp) {
            imagenWhatsApp = servicios[0].imagen_whatsapp;
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

*Equipo Serenity Spa*`;
        
        const numero = `${turno.codigo_pais || '53'}${turno.telefono}`;
        const whatsappUrl = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
        
        // Marcar como confirmado
        await supabase
            .from('turnos')
            .update({ confirmado_whatsapp: true })
            .eq('id', id);
        
        res.json({
            success: true,
            numero: numero,
            mensaje: mensaje,
            url: whatsappUrl,
            imagen: imagenWhatsApp
        });
    } catch (error) {
        console.error('Error preparando WhatsApp:', error);
        res.status(500).json({ error: 'Error al preparar mensaje' });
    }
});

// ============================================================
// 🚀 INICIAR SERVIDOR
// ============================================================

const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🌿 Serenity Spa iniciado en puerto ${PORT}`);
    console.log(`📂 Directorio base: ${BASE_DIR}`);
    console.log(`🗄️ Base de datos: Supabase (${process.env.SUPABASE_URL ? '✅ Conectada' : '❌ No configurada'})`);
    console.log(`🔐 Modo: ${process.env.NODE_ENV || 'development'}`);
});

process.on('SIGTERM', () => {
    console.log('🛑 Recibido SIGTERM, cerrando servidor...');
    server.close(() => {
        console.log('✅ Servidor cerrado');
        process.exit(0);
    });
});