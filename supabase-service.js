// ============================================================
// supabase-service.js - SERVICIO DE BASE DE DATOS
// Todas las operaciones con Supabase (SOLO SERVIDOR)
// ============================================================

const { createClient } = require('@supabase/supabase-js');

// ✅ Inicializar cliente Supabase con las variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERROR: Faltan variables de entorno de Supabase');
    console.error('   SUPABASE_URL:', supabaseUrl ? '✅ Configurada' : '❌ No configurada');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? '✅ Configurada' : '❌ No configurada');
    process.exit(1);
}

// ✅ Crear el cliente de Supabase
const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

console.log('✅ Conexión a Supabase establecida correctamente');

// ============================================================
// FUNCIONES DE UTILIDAD
// ============================================================
function sanitizeString(str) {
    if (!str) return '';
    return str.replace(/[<>]/g, '').trim();
}

// ============================================================
// TABLA: CONFIGURACIÓN GENERAL
// ============================================================
async function getConfiguracion(clave) {
    try {
        const { data, error } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', clave)
            .maybeSingle();
        
        if (error) throw error;
        return data?.valor || null;
    } catch (error) {
        console.error(`❌ Error en getConfiguracion(${clave}):`, error);
        return null;
    }
}

async function setConfiguracion(clave, valor) {
    try {
        const { error } = await supabase
            .from('configuracion')
            .upsert({ clave, valor, updated_at: new Date().toISOString() });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error(`❌ Error en setConfiguracion(${clave}):`, error);
        throw error;
    }
}

// ============================================================
// TABLA: CONFIGURACIÓN REGISTRO
// ============================================================
async function getConfiguracionRegistro() {
    try {
        const config = await getConfiguracion('registro');
        return config || {
            hero: { titulo: '', subtitulo: '', boton: '' },
            beneficios: [],
            conceptos: [],
            imagenWhatsApp: 'https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg'
        };
    } catch (error) {
        console.error('❌ Error en getConfiguracionRegistro:', error);
        return {
            hero: { titulo: '', subtitulo: '', boton: '' },
            beneficios: [],
            conceptos: [],
            imagenWhatsApp: 'https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg'
        };
    }
}

async function setConfiguracionRegistro(data) {
    try {
        return await setConfiguracion('registro', data);
    } catch (error) {
        console.error('❌ Error en setConfiguracionRegistro:', error);
        throw error;
    }
}

// ============================================================
// TABLA: HORARIOS
// ============================================================
async function getHorarios() {
    try {
        const config = await getConfiguracion('horarios');
        return config || {
            dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
            horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
            inicio: 8,
            fin: 20
        };
    } catch (error) {
        console.error('❌ Error en getHorarios:', error);
        return {
            dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
            horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
            inicio: 8,
            fin: 20
        };
    }
}

async function setHorarios(data) {
    try {
        return await setConfiguracion('horarios', data);
    } catch (error) {
        console.error('❌ Error en setHorarios:', error);
        throw error;
    }
}

// ============================================================
// TABLA: MODALIDADES
// ============================================================
async function getModalidades() {
    try {
        const config = await getConfiguracion('modalidades');
        return config || { salon_activo: true, domicilio_activo: true };
    } catch (error) {
        console.error('❌ Error en getModalidades:', error);
        return { salon_activo: true, domicilio_activo: true };
    }
}

async function setModalidades(data) {
    try {
        return await setConfiguracion('modalidades', data);
    } catch (error) {
        console.error('❌ Error en setModalidades:', error);
        throw error;
    }
}

// ============================================================
// TABLA: PAÍSES
// ============================================================
async function getPaises() {
    try {
        const config = await getConfiguracion('paises');
        return config || {
            autorizados: [],
            bloqueados: [],
            modo: 'todos',
            ubicacion_salon: 'Salón Serenity Spa'
        };
    } catch (error) {
        console.error('❌ Error en getPaises:', error);
        return {
            autorizados: [],
            bloqueados: [],
            modo: 'todos',
            ubicacion_salon: 'Salón Serenity Spa'
        };
    }
}

async function setPaises(data) {
    try {
        return await setConfiguracion('paises', data);
    } catch (error) {
        console.error('❌ Error en setPaises:', error);
        throw error;
    }
}

// ============================================================
// TABLA: PALABRAS BANEADAS
// ============================================================
async function getPalabrasBaneadas() {
    try {
        const { data, error } = await supabase
            .from('palabras_baneadas')
            .select('palabra')
            .order('palabra');
        
        if (error) throw error;
        return data.map(row => row.palabra);
    } catch (error) {
        console.error('❌ Error en getPalabrasBaneadas:', error);
        return [];
    }
}

async function addPalabraBaneada(palabra) {
    try {
        const { error } = await supabase
            .from('palabras_baneadas')
            .insert({ palabra: palabra.toLowerCase() });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error en addPalabraBaneada:', error);
        throw error;
    }
}

async function removePalabraBaneada(palabra) {
    try {
        const { error } = await supabase
            .from('palabras_baneadas')
            .delete()
            .eq('palabra', palabra.toLowerCase());
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error en removePalabraBaneada:', error);
        throw error;
    }
}

// ============================================================
// TABLA: SERVICIOS
// ============================================================
async function getServicios() {
    try {
        const { data, error } = await supabase
            .from('servicios')
            .select('*')
            .order('orden', { ascending: true });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error en getServicios:', error);
        return [];
    }
}

async function getServicioById(id) {
    try {
        const { data, error } = await supabase
            .from('servicios')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error en getServicioById:', error);
        return null;
    }
}

async function createServicio(servicio) {
    try {
        const { data, error } = await supabase
            .from('servicios')
            .insert([{
                id: servicio.id,
                nombre: sanitizeString(servicio.nombre),
                precio: servicio.precio,
                descripcion: sanitizeString(servicio.descripcion),
                beneficios: servicio.beneficios || [],
                efectos: servicio.efectos || [],
                imagen_web: servicio.imagen_web || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
                imagen_whatsapp: servicio.imagen_whatsapp || '',
                video_url: servicio.video_url || '',
                orden: servicio.orden || 0,
                created_at: new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('❌ Error en createServicio:', error);
        throw error;
    }
}

async function updateServicio(id, servicio) {
    try {
        const { data, error } = await supabase
            .from('servicios')
            .update({
                nombre: sanitizeString(servicio.nombre),
                precio: servicio.precio,
                descripcion: sanitizeString(servicio.descripcion),
                beneficios: servicio.beneficios || [],
                efectos: servicio.efectos || [],
                imagen_web: servicio.imagen_web || "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
                imagen_whatsapp: servicio.imagen_whatsapp || '',
                video_url: servicio.video_url || '',
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('❌ Error en updateServicio:', error);
        throw error;
    }
}

async function deleteServicio(id) {
    try {
        const { error } = await supabase
            .from('servicios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error en deleteServicio:', error);
        throw error;
    }
}

// ============================================================
// TABLA: TESTIMONIOS
// ============================================================
async function getTestimonios(soloPublicos = true) {
    try {
        let query = supabase
            .from('testimonios')
            .select('*')
            .order('fecha', { ascending: false });
        
        if (soloPublicos) {
            query = query.eq('publico', true);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error en getTestimonios:', error);
        return [];
    }
}

async function getTestimonioById(id) {
    try {
        const { data, error } = await supabase
            .from('testimonios')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error en getTestimonioById:', error);
        return null;
    }
}

async function createTestimonio(testimonio) {
    try {
        const { data, error } = await supabase
            .from('testimonios')
            .insert([{
                id: testimonio.id,
                nombre: sanitizeString(testimonio.nombre),
                calificacion: testimonio.calificacion,
                comentario: sanitizeString(testimonio.comentario),
                imagen: testimonio.imagen || null,
                publico: testimonio.publico !== false,
                fecha: testimonio.fecha || new Date().toISOString()
            }])
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('❌ Error en createTestimonio:', error);
        throw error;
    }
}

async function updateTestimonio(id, data) {
    try {
        const { error } = await supabase
            .from('testimonios')
            .update({
                publico: data.publico,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error en updateTestimonio:', error);
        throw error;
    }
}

async function deleteTestimonio(id) {
    try {
        const { error } = await supabase
            .from('testimonios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error en deleteTestimonio:', error);
        throw error;
    }
}

// ============================================================
// TABLA: TURNOS
// ============================================================
async function getTurnos() {
    try {
        const { data, error } = await supabase
            .from('turnos')
            .select('*')
            .order('fecha_creacion', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error en getTurnos:', error);
        return [];
    }
}

async function getTurnoById(id) {
    try {
        const { data, error } = await supabase
            .from('turnos')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error en getTurnoById:', error);
        return null;
    }
}

async function getTurnosByFecha(fecha) {
    try {
        const { data, error } = await supabase
            .from('turnos')
            .select('*')
            .eq('fecha', fecha);
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error en getTurnosByFecha:', error);
        return [];
    }
}

async function createTurno(turno) {
    try {
        const { data, error } = await supabase
            .from('turnos')
            .insert([{
                id: turno.id,
                nombre: sanitizeString(turno.nombre),
                dia: turno.dia,
                fecha: turno.fecha,
                hora: turno.hora,
                massage_type: turno.massage_type,
                telefono: turno.telefono,
                codigo_pais: turno.codigo_pais || '53',
                ubicacion: turno.ubicacion || 'Salón Serenity Spa',
                tipo_servicio: turno.tipo_servicio || 'salon',
                confirmado_whatsapp: turno.confirmado_whatsapp || false,
                fecha_creacion: turno.fecha_creacion || new Date().toISOString(),
                codigo_cancelacion: turno.codigo_cancelacion,
                ip: turno.ip || 'N/A',
                conteo_bloqueos: turno.conteo_bloqueos || 0
            }])
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('❌ Error en createTurno:', error);
        throw error;
    }
}

async function updateTurno(id, data) {
    try {
        const { error } = await supabase
            .from('turnos')
            .update({
                confirmado_whatsapp: data.confirmado_whatsapp,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error en updateTurno:', error);
        throw error;
    }
}

async function deleteTurno(id) {
    try {
        const { error } = await supabase
            .from('turnos')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error en deleteTurno:', error);
        throw error;
    }
}

// ============================================================
// TABLA: USUARIOS
// ============================================================
async function getUsuarios() {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .order('fecha_registro', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error en getUsuarios:', error);
        return [];
    }
}

async function getUsuarioById(id) {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error en getUsuarioById:', error);
        return null;
    }
}

async function getUsuarioByEmail(email) {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error en getUsuarioByEmail:', error);
        return null;
    }
}

async function getUsuarioByToken(token) {
    try {
        const { data, error } = await supabase
            .from('tokens_usuarios')
            .select('email')
            .eq('token', token)
            .gt('expiracion', new Date().toISOString())
            .maybeSingle();
        
        if (error) throw error;
        if (!data) return null;
        
        return await getUsuarioByEmail(data.email);
    } catch (error) {
        console.error('❌ Error en getUsuarioByToken:', error);
        return null;
    }
}

async function createUsuario(usuario) {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .insert([{
                id: usuario.id,
                nombre: sanitizeString(usuario.nombre),
                email: usuario.email,
                verificado: usuario.verificado || true,
                fecha_registro: usuario.fecha_registro || new Date().toISOString(),
                bloqueado: usuario.bloqueado || false,
                motivo_bloqueo: usuario.motivo_bloqueo || null,
                avatar: usuario.avatar || null
            }])
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('❌ Error en createUsuario:', error);
        throw error;
    }
}

async function updateUsuario(id, usuario) {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .update({
                nombre: sanitizeString(usuario.nombre),
                verificado: usuario.verificado,
                bloqueado: usuario.bloqueado,
                motivo_bloqueo: usuario.motivo_bloqueo,
                avatar: usuario.avatar,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error('❌ Error en updateUsuario:', error);
        throw error;
    }
}

async function deleteUsuario(id) {
    try {
        const { error } = await supabase
            .from('usuarios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error en deleteUsuario:', error);
        throw error;
    }
}

// ============================================================
// TABLA: CÓDIGOS DE VERIFICACIÓN
// ============================================================
async function getCodigoVerificacion(email) {
    try {
        const { data, error } = await supabase
            .from('codigos_verificacion')
            .select('*')
            .eq('email', email)
            .maybeSingle();
        
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('❌ Error en getCodigoVerificacion:', error);
        return null;
    }
}

async function upsertCodigoVerificacion(email, data) {
    try {
        const { error } = await supabase
            .from('codigos_verificacion')
            .upsert({
                email: email,
                codigo: data.codigo,
                expiracion: data.expiracion,
                intentos: data.intentos || 0,
                nombre: data.nombre || '',
                created_at: new Date().toISOString()
            });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error en upsertCodigoVerificacion:', error);
        throw error;
    }
}

async function deleteCodigoVerificacion(email) {
    try {
        const { error } = await supabase
            .from('codigos_verificacion')
            .delete()
            .eq('email', email);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error en deleteCodigoVerificacion:', error);
        throw error;
    }
}

// ============================================================
// TABLA: TOKENS DE USUARIOS
// ============================================================
async function createTokenUsuario(token, email) {
    try {
        const expiracion = new Date();
        expiracion.setDate(expiracion.getDate() + 30); // 30 días
        
        const { error } = await supabase
            .from('tokens_usuarios')
            .insert({
                token: token,
                email: email,
                expiracion: expiracion.toISOString(),
                created_at: new Date().toISOString()
            });
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error en createTokenUsuario:', error);
        throw error;
    }
}

// ============================================================
// TABLA: BLOQUEOS
// ============================================================
async function getBloqueosActivos() {
    try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('bloqueos')
            .select('*')
            .or(`permanente.eq.true,and(hasta.gt.${now})`)
            .order('fecha', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('❌ Error en getBloqueosActivos:', error);
        return [];
    }
}

async function deleteBloqueoByIP(ip) {
    try {
        const { error } = await supabase
            .from('bloqueos')
            .delete()
            .eq('ip', ip);
        
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('❌ Error en deleteBloqueoByIP:', error);
        throw error;
    }
}

// ============================================================
// EXPORTAR TODAS LAS FUNCIONES
// ============================================================
module.exports = {
    // Configuración
    getConfiguracion,
    setConfiguracion,
    getConfiguracionRegistro,
    setConfiguracionRegistro,
    
    // Horarios
    getHorarios,
    setHorarios,
    
    // Modalidades
    getModalidades,
    setModalidades,
    
    // Países
    getPaises,
    setPaises,
    
    // Palabras baneadas
    getPalabrasBaneadas,
    addPalabraBaneada,
    removePalabraBaneada,
    
    // Servicios
    getServicios,
    getServicioById,
    createServicio,
    updateServicio,
    deleteServicio,
    
    // Testimonios
    getTestimonios,
    getTestimonioById,
    createTestimonio,
    updateTestimonio,
    deleteTestimonio,
    
    // Turnos
    getTurnos,
    getTurnoById,
    getTurnosByFecha,
    createTurno,
    updateTurno,
    deleteTurno,
    
    // Usuarios
    getUsuarios,
    getUsuarioById,
    getUsuarioByEmail,
    getUsuarioByToken,
    createUsuario,
    updateUsuario,
    deleteUsuario,
    
    // Códigos de verificación
    getCodigoVerificacion,
    upsertCodigoVerificacion,
    deleteCodigoVerificacion,
    
    // Tokens
    createTokenUsuario,
    
    // Bloqueos
    getBloqueosActivos,
    deleteBloqueoByIP
};