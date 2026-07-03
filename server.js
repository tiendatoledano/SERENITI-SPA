const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
require('dotenv').config();

// ============================================================
// SUPABASE CLIENT
// ============================================================
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const app = express();
const PORT = process.env.PORT || 5001;
const BASE_DIR = __dirname;

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors());
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
    return crypto.randomUUID();
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
// RUTAS DE AUTENTICACIÓN ADMIN
// ============================================================
const validTokens = new Map();

app.post('/api/login', async (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (password === adminPassword) {
        const token = crypto.randomBytes(64).toString('hex');
        validTokens.set(token, Date.now() + 28800000);
        
        // Guardar token en Supabase (opcional)
        await supabase
            .from('tokens_sesion')
            .insert([{ token, email: 'admin', expiracion: new Date(Date.now() + 28800000).toISOString() }]);
        
        res.json({ success: true, token });
    } else {
        res.status(401).json({ success: false, mensaje: 'Contraseña incorrecta' });
    }
});

app.get('/api/verify', (req, res) => {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) return res.json({ valid: false });
    const token = h.substring(7);
    res.json({ valid: validTokens.has(token) && validTokens.get(token) > Date.now() });
});

// ============================================================
// USUARIOS - SUPABASE
// ============================================================
app.get('/api/usuarios', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .order('fecha_registro', { ascending: false });
        
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        res.status(500).json({ error: 'Error al cargar usuarios' });
    }
});

app.delete('/api/usuarios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabase
            .from('usuarios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
});

app.put('/api/usuarios/:id/bloquear', async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        
        // Obtener estado actual
        const { data: usuario, error: getError } = await supabase
            .from('usuarios')
            .select('bloqueado')
            .eq('id', id)
            .single();
        
        if (getError) throw getError;
        
        const nuevoEstado = !usuario.bloqueado;
        const { error } = await supabase
            .from('usuarios')
            .update({
                bloqueado: nuevoEstado,
                motivo_bloqueo: nuevoEstado ? (motivo || 'Bloqueado por admin') : null
            })
            .eq('id', id);
        
        if (error) throw error;
        res.json({ success: true, message: `Usuario ${nuevoEstado ? 'bloqueado' : 'desbloqueado'}` });
    } catch (error) {
        console.error('Error cambiando estado:', error);
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
});

// ============================================================
// TURNOS - SUPABASE
// ============================================================
app.post('/turnos', async (req, res) => {
    try {
        const { nombre, telefono, massageType, dia, hora, codigoPais, ubicacion, tipoServicio, fecha, ip } = req.body;
        
        if (!nombre || !telefono || !massageType || !dia || hora === undefined) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        
        // Verificar disponibilidad
        const { data: ocupados, error: checkError } = await supabase
            .from('turnos')
            .select('id')
            .eq('dia', dia.toLowerCase())
            .eq('hora', parseInt(hora))
            .eq('fecha', fecha || new Date().toISOString().split('T')[0]);
        
        if (checkError) throw checkError;
        
        if (ocupados && ocupados.length > 0) {
            return res.status(409).json({ error: 'Horario ocupado' });
        }
        
        const codigoCancelacion = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const nuevoTurno = {
            id: generarId(),
            nombre: escapeHtml(nombre.trim()),
            dia: dia.toLowerCase(),
            fecha: fecha || new Date().toISOString().split('T')[0],
            hora: parseInt(hora),
            massage_type: massageType,
            telefono: telefono.replace(/\D/g, ''),
            codigo_pais: codigoPais || '53',
            ubicacion: ubicacion || 'Salón Serenity Spa',
            tipo_servicio: tipoServicio || 'salon',
            confirmado_whatsapp: false,
            codigo_cancelacion: codigoCancelacion,
            ip: ip || 'N/A',
            fecha_creacion: new Date().toISOString()
        };
        
        const { data, error } = await supabase
            .from('turnos')
            .insert([nuevoTurno])
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json({
            mensaje: 'Turno reservado',
            turno: data,
            codigoCancelacion: codigoCancelacion
        });
    } catch (error) {
        console.error('Error creando turno:', error);
        res.status(500).json({ error: 'Error al crear el turno' });
    }
});

app.get('/turnos', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('turnos')
            .select('*')
            .order('fecha_creacion', { ascending: false });
        
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error cargando turnos:', error);
        res.json([]);
    }
});

app.delete('/turnos/:id', async (req, res) => {
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

// ============================================================
// TESTIMONIOS - SUPABASE
// ============================================================
app.get('/api/testimonios', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('testimonios')
            .select('*')
            .eq('publico', true)
            .order('fecha', { ascending: false });
        
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error cargando testimonios:', error);
        res.json([]);
    }
});

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
            .insert([testimonio])
            .select()
            .single();
        
        if (error) throw error;
        
        console.log(`✅ Testimonio guardado de ${testimonio.nombre} (${testimonio.calificacion}⭐)`);
        res.status(201).json({ success: true, testimonio: data });
    } catch (error) {
        console.error('Error guardando testimonio:', error);
        res.status(500).json({ error: 'Error al guardar el testimonio' });
    }
});

// ============================================================
// CONFIGURACIÓN - SUPABASE
// ============================================================
app.get('/api/config', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', 'general')
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        res.json(data?.valor || {});
    } catch (error) {
        console.error('Error cargando configuración:', error);
        res.json({});
    }
});

app.put('/api/config', async (req, res) => {
    try {
        const config = req.body;
        const { error } = await supabase
            .from('configuracion')
            .upsert({
                clave: 'general',
                valor: config,
                updated_at: new Date().toISOString()
            }, { onConflict: 'clave' });
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error guardando configuración:', error);
        res.status(500).json({ error: 'Error al guardar la configuración' });
    }
});

// ============================================================
// SERVICIOS - SUPABASE
// ============================================================
app.get('/api/servicios', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('servicios')
            .select('*')
            .order('orden', { ascending: true });
        
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error cargando servicios:', error);
        res.status(500).json({ error: 'Error al obtener servicios' });
    }
});

app.post('/api/servicios', async (req, res) => {
    try {
        const { nombre, precio, descripcion, beneficios, efectos, imagenWeb, imagenWhatsApp, videoUrl } = req.body;
        
        if (!nombre || !precio || !descripcion) {
            return res.status(400).json({ error: 'Nombre, precio y descripción son obligatorios' });
        }
        
        // Obtener último orden
        const { data: servicios, error: getError } = await supabase
            .from('servicios')
            .select('orden')
            .order('orden', { ascending: false })
            .limit(1);
        
        if (getError) throw getError;
        
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
            orden: (servicios && servicios.length > 0) ? servicios[0].orden + 1 : 1
        };
        
        const { data, error } = await supabase
            .from('servicios')
            .insert([nuevoServicio])
            .select()
            .single();
        
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creando servicio:', error);
        res.status(500).json({ error: 'Error al crear el servicio' });
    }
});

app.put('/api/servicios/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, precio, descripcion, beneficios, efectos, imagenWeb, imagenWhatsApp, videoUrl } = req.body;
        
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
                video_url: videoUrl || '',
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
        
        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error actualizando servicio:', error);
        res.status(500).json({ error: 'Error al actualizar el servicio' });
    }
});

app.delete('/api/servicios/:id', async (req, res) => {
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
// HORARIOS - SUPABASE
// ============================================================
app.get('/api/config/horarios', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('horarios')
            .select('dias, horarios')
            .limit(1)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        res.json(data || { dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'], horarios: ['12:00', '16:00', '20:00'] });
    } catch (error) {
        console.error('Error cargando horarios:', error);
        res.json({ dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'], horarios: ['12:00', '16:00', '20:00'] });
    }
});

app.put('/api/config/horarios', async (req, res) => {
    try {
        const { dias, horarios } = req.body;
        
        const { error } = await supabase
            .from('horarios')
            .upsert({
                id: '00000000-0000-0000-0000-000000000001',
                dias: dias || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
                horarios: horarios || ['12:00', '16:00', '20:00'],
                updated_at: new Date().toISOString()
            });
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error guardando horarios:', error);
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// ============================================================
// PAÍSES - SUPABASE
// ============================================================
app.get('/api/seguridad/paises', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('paises')
            .select('autorizados, bloqueados, modo, ubicacion_salon')
            .limit(1)
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        res.json(data || { autorizados: [], bloqueados: [], modo: 'todos', ubicacion_salon: 'Salón Serenity Spa' });
    } catch (error) {
        console.error('Error cargando países:', error);
        res.json({ autorizados: [], bloqueados: [], modo: 'todos', ubicacion_salon: 'Salón Serenity Spa' });
    }
});

app.put('/api/seguridad/paises', async (req, res) => {
    try {
        const { modo, ubicacionSalon } = req.body;
        
        const { error } = await supabase
            .from('paises')
            .upsert({
                id: '00000000-0000-0000-0000-000000000002',
                modo: modo || 'todos',
                ubicacion_salon: ubicacionSalon || 'Salón Serenity Spa',
                updated_at: new Date().toISOString()
            });
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error guardando países:', error);
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// ============================================================
// PALABRAS BANEADAS - SUPABASE
// ============================================================
app.get('/api/palabras-baneadas', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('palabras_baneadas')
            .select('palabra');
        
        if (error) throw error;
        res.json({ palabras: data?.map(p => p.palabra) || [] });
    } catch (error) {
        console.error('Error cargando palabras baneadas:', error);
        res.json({ palabras: [] });
    }
});

app.post('/api/palabras-baneadas', async (req, res) => {
    try {
        const { palabra, accion } = req.body;
        
        if (accion === 'agregar') {
            const { error } = await supabase
                .from('palabras_baneadas')
                .insert([{ palabra: palabra.toLowerCase() }]);
            
            if (error) throw error;
        } else if (accion === 'eliminar') {
            const { error } = await supabase
                .from('palabras_baneadas')
                .delete()
                .eq('palabra', palabra.toLowerCase());
            
            if (error) throw error;
        }
        
        // Obtener lista actualizada
        const { data, error } = await supabase
            .from('palabras_baneadas')
            .select('palabra');
        
        if (error) throw error;
        res.json({ success: true, palabras: data?.map(p => p.palabra) || [] });
    } catch (error) {
        console.error('Error modificando palabras baneadas:', error);
        res.status(500).json({ error: 'Error al modificar palabras baneadas' });
    }
});

// ============================================================
// IA - PERSONALIDAD - SUPABASE
// ============================================================
app.get('/api/ia/personalidad', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', 'ia_personalidad')
            .single();
        
        if (error && error.code !== 'PGRST116') throw error;
        res.json(data?.valor || { nombre: 'Asistente Serenity', tono: 'cálido y profesional', estilo: '', reglas: [] });
    } catch (error) {
        console.error('Error cargando personalidad IA:', error);
        res.json({ nombre: 'Asistente Serenity', tono: 'cálido y profesional', estilo: '', reglas: [] });
    }
});

app.put('/api/ia/personalidad', async (req, res) => {
    try {
        const iaData = req.body;
        
        const { error } = await supabase
            .from('configuracion')
            .upsert({
                clave: 'ia_personalidad',
                valor: iaData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'clave' });
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error guardando personalidad IA:', error);
        res.status(500).json({ error: 'Error al guardar' });
    }
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌿 Serenity Spa iniciado en puerto ${PORT}`);
    console.log(`📂 Directorio base: ${BASE_DIR}`);
    console.log(`🗄️ Usando Supabase como base de datos`);
    console.log(`🔐 ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? 'Configurada ✓' : 'Usando valor por defecto ⚠️'}`);
});