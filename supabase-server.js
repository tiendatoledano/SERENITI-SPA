// ============================================================
// supabase-service.js - CAPA DE SERVICIOS
// SOLO SE EJECUTA EN EL SERVIDOR
// Todas las funciones usan supabaseAdmin con Service Role Key
// ============================================================

const { supabaseAdmin } = require('./supabase-client');

// ============================================================
// UTILIDADES
// ============================================================
function generarId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2) + 
           require('crypto').randomBytes(4).toString('hex');
}

// ============================================================
// SERVICIOS
// ============================================================
async function getServicios() {
    const { data, error } = await supabaseAdmin
        .from('servicios')
        .select('*')
        .order('orden', { ascending: true });
    if (error) throw error;
    return data || [];
}

async function getServicioById(id) {
    const { data, error } = await supabaseAdmin
        .from('servicios')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}

async function createServicio(servicio) {
    const { data, error } = await supabaseAdmin
        .from('servicios')
        .insert(servicio)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function updateServicio(id, servicio) {
    const { data, error } = await supabaseAdmin
        .from('servicios')
        .update(servicio)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function deleteServicio(id) {
    const { error } = await supabaseAdmin
        .from('servicios')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
}

// ============================================================
// TURNOS
// ============================================================
async function getTurnos() {
    const { data, error } = await supabaseAdmin
        .from('turnos')
        .select('*')
        .order('fecha_creacion', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function getTurnosByFecha(fecha) {
    const { data, error } = await supabaseAdmin
        .from('turnos')
        .select('*')
        .eq('fecha', fecha);
    if (error) throw error;
    return data || [];
}

async function getTurnoById(id) {
    const { data, error } = await supabaseAdmin
        .from('turnos')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}

async function createTurno(turno) {
    const { data, error } = await supabaseAdmin
        .from('turnos')
        .insert(turno)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function updateTurno(id, turno) {
    const { data, error } = await supabaseAdmin
        .from('turnos')
        .update(turno)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function deleteTurno(id) {
    const { error } = await supabaseAdmin
        .from('turnos')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
}

// ============================================================
// TESTIMONIOS
// ============================================================
async function getTestimonios(publicoOnly = true) {
    let query = supabaseAdmin.from('testimonios').select('*');
    if (publicoOnly) {
        query = query.eq('publico', true);
    }
    const { data, error } = await query.order('fecha', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function getTestimonioById(id) {
    const { data, error } = await supabaseAdmin
        .from('testimonios')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}

async function createTestimonio(testimonio) {
    const { data, error } = await supabaseAdmin
        .from('testimonios')
        .insert(testimonio)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function updateTestimonio(id, testimonio) {
    const { data, error } = await supabaseAdmin
        .from('testimonios')
        .update(testimonio)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function deleteTestimonio(id) {
    const { error } = await supabaseAdmin
        .from('testimonios')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
}

// ============================================================
// USUARIOS
// ============================================================
async function getUsuarios() {
    const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .order('fecha_registro', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function getUsuarioByEmail(email) {
    const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .eq('email', email)
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function getUsuarioById(id) {
    const { data, error } = await supabaseAdmin
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .single();
    if (error) throw error;
    return data;
}

async function createUsuario(usuario) {
    const { data, error } = await supabaseAdmin
        .from('usuarios')
        .insert(usuario)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function updateUsuario(id, usuario) {
    const { data, error } = await supabaseAdmin
        .from('usuarios')
        .update(usuario)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function deleteUsuario(id) {
    const { error } = await supabaseAdmin
        .from('usuarios')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
}

// ============================================================
// CÓDIGOS DE VERIFICACIÓN
// ============================================================
async function getCodigoVerificacion(email) {
    const { data, error } = await supabaseAdmin
        .from('codigos_verificacion')
        .select('*')
        .eq('email', email)
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function upsertCodigoVerificacion(email, data) {
    const { error } = await supabaseAdmin
        .from('codigos_verificacion')
        .upsert({ email, ...data }, { onConflict: 'email' });
    if (error) throw error;
    return true;
}

async function deleteCodigoVerificacion(email) {
    const { error } = await supabaseAdmin
        .from('codigos_verificacion')
        .delete()
        .eq('email', email);
    if (error) throw error;
    return true;
}

// ============================================================
// TOKENS DE USUARIO
// ============================================================
async function getUsuarioByToken(token) {
    const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from('tokens_usuario')
        .select('email')
        .eq('token', token)
        .maybeSingle();
    if (tokenError) throw tokenError;
    if (!tokenData) return null;
    
    return await getUsuarioByEmail(tokenData.email);
}

async function createTokenUsuario(token, email) {
    const { error } = await supabaseAdmin
        .from('tokens_usuario')
        .insert({ token, email });
    if (error) throw error;
    return true;
}

async function deleteTokenUsuario(token) {
    const { error } = await supabaseAdmin
        .from('tokens_usuario')
        .delete()
        .eq('token', token);
    if (error) throw error;
    return true;
}

// ============================================================
// CONFIGURACIÓN
// ============================================================
async function getConfiguracion(clave) {
    const { data, error } = await supabaseAdmin
        .from('configuracion')
        .select('valor')
        .eq('clave', clave)
        .maybeSingle();
    if (error) throw error;
    return data?.valor || null;
}

async function setConfiguracion(clave, valor) {
    const { error } = await supabaseAdmin
        .from('configuracion')
        .upsert({ 
            clave, 
            valor, 
            updated_at: new Date().toISOString() 
        }, { onConflict: 'clave' });
    if (error) throw error;
    return true;
}

// ============================================================
// HORARIOS
// ============================================================
async function getHorarios() {
    const { data, error } = await supabaseAdmin
        .from('horarios')
        .select('*')
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data || { 
        dias: ['lunes','martes','miercoles','jueves','viernes','sabado'], 
        horarios: ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'], 
        inicio: 8, 
        fin: 20 
    };
}

async function setHorarios(horarios) {
    const { data, error } = await supabaseAdmin
        .from('horarios')
        .upsert({ 
            id: 1, 
            ...horarios, 
            updated_at: new Date().toISOString() 
        }, { onConflict: 'id' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ============================================================
// MODALIDADES
// ============================================================
async function getModalidades() {
    const { data, error } = await supabaseAdmin
        .from('modalidades')
        .select('*')
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data || { salon_activo: true, domicilio_activo: true };
}

async function setModalidades(modalidades) {
    const { data, error } = await supabaseAdmin
        .from('modalidades')
        .upsert({ 
            id: 1, 
            ...modalidades, 
            updated_at: new Date().toISOString() 
        }, { onConflict: 'id' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ============================================================
// PAÍSES
// ============================================================
async function getPaises() {
    const { data, error } = await supabaseAdmin
        .from('paises')
        .select('*')
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data || { 
        autorizados: [], 
        bloqueados: [], 
        modo: 'todos', 
        ubicacion_salon: 'Salón Serenity Spa' 
    };
}

async function setPaises(paises) {
    const { data, error } = await supabaseAdmin
        .from('paises')
        .upsert({ 
            id: 1, 
            ...paises, 
            updated_at: new Date().toISOString() 
        }, { onConflict: 'id' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ============================================================
// PALABRAS BANEADAS
// ============================================================
async function getPalabrasBaneadas() {
    const { data, error } = await supabaseAdmin
        .from('palabras_baneadas')
        .select('palabra');
    if (error) throw error;
    return data.map(p => p.palabra) || [];
}

async function addPalabraBaneada(palabra) {
    const { error } = await supabaseAdmin
        .from('palabras_baneadas')
        .insert({ palabra });
    if (error && error.code !== '23505') throw error;
    return true;
}

async function removePalabraBaneada(palabra) {
    const { error } = await supabaseAdmin
        .from('palabras_baneadas')
        .delete()
        .eq('palabra', palabra);
    if (error) throw error;
    return true;
}

// ============================================================
// BLOQUEOS DE SEGURIDAD
// ============================================================
async function getBloqueosActivos() {
    const ahora = Date.now();
    const { data, error } = await supabaseAdmin
        .from('bloqueos_seguridad')
        .select('*')
        .or(`permanente.eq.true,expiracion.gt.${ahora}`);
    if (error) throw error;
    return data || [];
}

async function getBloqueoByIP(ip) {
    const ahora = Date.now();
    const { data, error } = await supabaseAdmin
        .from('bloqueos_seguridad')
        .select('*')
        .eq('ip', ip)
        .or(`permanente.eq.true,expiracion.gt.${ahora}`)
        .order('fecha_bloqueo', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data;
}

async function createBloqueo(bloqueo) {
    const { data, error } = await supabaseAdmin
        .from('bloqueos_seguridad')
        .insert(bloqueo)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function deleteBloqueo(id) {
    const { error } = await supabaseAdmin
        .from('bloqueos_seguridad')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
}

async function deleteBloqueoByIP(ip) {
    const { error } = await supabaseAdmin
        .from('bloqueos_seguridad')
        .delete()
        .eq('ip', ip);
    if (error) throw error;
    return true;
}

// ============================================================
// ATAQUES
// ============================================================
async function getAtaques() {
    const { data, error } = await supabaseAdmin
        .from('ataques')
        .select('*')
        .order('fecha', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function createAtaque(ataque) {
    const { data, error } = await supabaseAdmin
        .from('ataques')
        .insert(ataque)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function updateAtaque(id, ataque) {
    const { data, error } = await supabaseAdmin
        .from('ataques')
        .update(ataque)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
}

async function deleteAtaque(id) {
    const { error } = await supabaseAdmin
        .from('ataques')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
}

// ============================================================
// CONFIGURACIÓN DE REGISTRO
// ============================================================
async function getConfiguracionRegistro() {
    const { data, error } = await supabaseAdmin
        .from('configuracion_registro')
        .select('valor')
        .eq('clave', 'registro')
        .maybeSingle();
    if (error) throw error;
    return data?.valor || {};
}

async function setConfiguracionRegistro(valor) {
    const { error } = await supabaseAdmin
        .from('configuracion_registro')
        .upsert({ 
            clave: 'registro', 
            valor, 
            updated_at: new Date().toISOString() 
        }, { onConflict: 'clave' });
    if (error) throw error;
    return true;
}

// ============================================================
// EXPORTAR TODAS LAS FUNCIONES
// ============================================================
module.exports = {
    // Servicios
    getServicios,
    getServicioById,
    createServicio,
    updateServicio,
    deleteServicio,
    
    // Turnos
    getTurnos,
    getTurnosByFecha,
    getTurnoById,
    createTurno,
    updateTurno,
    deleteTurno,
    
    // Testimonios
    getTestimonios,
    getTestimonioById,
    createTestimonio,
    updateTestimonio,
    deleteTestimonio,
    
    // Usuarios
    getUsuarios,
    getUsuarioByEmail,
    getUsuarioById,
    createUsuario,
    updateUsuario,
    deleteUsuario,
    
    // Códigos de verificación
    getCodigoVerificacion,
    upsertCodigoVerificacion,
    deleteCodigoVerificacion,
    
    // Tokens
    getUsuarioByToken,
    createTokenUsuario,
    deleteTokenUsuario,
    
    // Configuración
    getConfiguracion,
    setConfiguracion,
    
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
    
    // Bloqueos de seguridad
    getBloqueosActivos,
    getBloqueoByIP,
    createBloqueo,
    deleteBloqueo,
    deleteBloqueoByIP,
    
    // Ataques
    getAtaques,
    createAtaque,
    updateAtaque,
    deleteAtaque,
    
    // Configuración de registro
    getConfiguracionRegistro,
    setConfiguracionRegistro
};