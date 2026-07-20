// ============================================================
// supabase-service.js - SERVICIO DE SUPABASE
// ============================================================

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

console.log('✅ Supabase inicializado correctamente (modo admin)');

// ============================================================
// FUNCIONES DE UTILIDAD
// ============================================================

function escapeSql(str) {
    if (!str) return '';
    return str.replace(/['"]/g, '');
}

// ============================================================
// CONFIGURACIÓN GENERAL
// ============================================================

async function getConfiguracion(tipo) {
    try {
        const { data, error } = await supabase
            .from('configuracion')
            .select('*')
            .eq('tipo', tipo)
            .maybeSingle();
        
        if (error) {
            console.error(`Error obteniendo configuración ${tipo}:`, error);
            return null;
        }
        return data?.contenido || null;
    } catch (e) {
        console.error('Error en getConfiguracion:', e);
        return null;
    }
}

async function setConfiguracion(tipo, contenido) {
    try {
        const { error } = await supabase
            .from('configuracion')
            .upsert({
                tipo: tipo,
                contenido: contenido,
                actualizado: new Date().toISOString()
            }, { onConflict: 'tipo' });
        
        if (error) {
            console.error(`Error guardando configuración ${tipo}:`, error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en setConfiguracion:', e);
        return false;
    }
}

// ============================================================
// CONFIGURACIÓN DE REGISTRO
// ============================================================

async function getConfiguracionRegistro() {
    return getConfiguracion('registro');
}

async function setConfiguracionRegistro(contenido) {
    return setConfiguracion('registro', contenido);
}

// ============================================================
// HORARIOS
// ============================================================

async function getHorarios() {
    try {
        const config = await getConfiguracion('horarios');
        if (config) {
            return {
                dias: config.dias || ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
                horarios: config.horarios || ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
                inicio: config.inicio || 8,
                fin: config.fin || 20
            };
        }
        return {
            dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
            horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
            inicio: 8,
            fin: 20
        };
    } catch (e) {
        console.error('Error en getHorarios:', e);
        return {
            dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
            horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
            inicio: 8,
            fin: 20
        };
    }
}

async function setHorarios(data) {
    return setConfiguracion('horarios', data);
}

// ============================================================
// MODALIDADES
// ============================================================

async function getModalidades() {
    try {
        const config = await getConfiguracion('modalidades');
        if (config) {
            return {
                salon_activo: config.salon_activo !== false,
                domicilio_activo: config.domicilio_activo !== false
            };
        }
        return { salon_activo: true, domicilio_activo: true };
    } catch (e) {
        return { salon_activo: true, domicilio_activo: true };
    }
}

async function setModalidades(data) {
    return setConfiguracion('modalidades', data);
}

// ============================================================
// PAÍSES
// ============================================================

async function getPaises() {
    try {
        const config = await getConfiguracion('paises');
        if (config) {
            return {
                autorizados: config.autorizados || [],
                bloqueados: config.bloqueados || [],
                modo: config.modo || 'todos',
                ubicacion_salon: config.ubicacion_salon || 'Salón Serenity Spa'
            };
        }
        return { autorizados: [], bloqueados: [], modo: 'todos', ubicacion_salon: 'Salón Serenity Spa' };
    } catch (e) {
        return { autorizados: [], bloqueados: [], modo: 'todos', ubicacion_salon: 'Salón Serenity Spa' };
    }
}

async function setPaises(data) {
    return setConfiguracion('paises', data);
}

// ============================================================
// PALABRAS BANEADAS
// ============================================================

async function getPalabrasBaneadas() {
    try {
        const config = await getConfiguracion('palabras_baneadas');
        return config?.palabras || [];
    } catch (e) {
        return [];
    }
}

async function addPalabraBaneada(palabra) {
    try {
        const palabras = await getPalabrasBaneadas();
        if (!palabras.includes(palabra)) {
            palabras.push(palabra);
            await setConfiguracion('palabras_baneadas', { palabras });
        }
        return true;
    } catch (e) {
        console.error('Error en addPalabraBaneada:', e);
        return false;
    }
}

async function removePalabraBaneada(palabra) {
    try {
        const palabras = await getPalabrasBaneadas();
        const index = palabras.indexOf(palabra);
        if (index !== -1) {
            palabras.splice(index, 1);
            await setConfiguracion('palabras_baneadas', { palabras });
        }
        return true;
    } catch (e) {
        console.error('Error en removePalabraBaneada:', e);
        return false;
    }
}

// ============================================================
// USUARIOS
// ============================================================

async function getUsuarios() {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .order('fecha_registro', { ascending: false });
        
        if (error) {
            console.error('Error obteniendo usuarios:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error en getUsuarios:', e);
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
        
        if (error) {
            console.error('Error obteniendo usuario por ID:', error);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Error en getUsuarioById:', e);
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
        
        if (error) {
            console.error('Error obteniendo usuario por email:', error);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Error en getUsuarioByEmail:', e);
        return null;
    }
}

async function getUsuarioByToken(token) {
    try {
        const { data: tokenData, error: tokenError } = await supabase
            .from('tokens_usuarios')
            .select('email')
            .eq('token', token)
            .maybeSingle();
        
        if (tokenError || !tokenData) {
            return null;
        }
        
        return getUsuarioByEmail(tokenData.email);
    } catch (e) {
        console.error('Error en getUsuarioByToken:', e);
        return null;
    }
}

async function createUsuario(usuario) {
    try {
        const { error } = await supabase
            .from('usuarios')
            .insert([usuario]);
        
        if (error) {
            console.error('Error creando usuario:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en createUsuario:', e);
        return false;
    }
}

async function updateUsuario(id, data) {
    try {
        const { error } = await supabase
            .from('usuarios')
            .update(data)
            .eq('id', id);
        
        if (error) {
            console.error('Error actualizando usuario:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en updateUsuario:', e);
        return false;
    }
}

async function deleteUsuario(id) {
    try {
        const { error } = await supabase
            .from('usuarios')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error eliminando usuario:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en deleteUsuario:', e);
        return false;
    }
}

// ============================================================
// CÓDIGOS DE VERIFICACIÓN
// ============================================================

async function getCodigoVerificacion(email) {
    try {
        const { data, error } = await supabase
            .from('codigos_verificacion')
            .select('*')
            .eq('email', email)
            .maybeSingle();
        
        if (error) {
            console.error('Error obteniendo código de verificación:', error);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Error en getCodigoVerificacion:', e);
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
                nombre: data.nombre,
                actualizado: new Date().toISOString()
            }, { onConflict: 'email' });
        
        if (error) {
            console.error('Error guardando código de verificación:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en upsertCodigoVerificacion:', e);
        return false;
    }
}

async function deleteCodigoVerificacion(email) {
    try {
        const { error } = await supabase
            .from('codigos_verificacion')
            .delete()
            .eq('email', email);
        
        if (error) {
            console.error('Error eliminando código de verificación:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en deleteCodigoVerificacion:', e);
        return false;
    }
}

// ============================================================
// TOKENS DE USUARIOS
// ============================================================

async function createTokenUsuario(token, email) {
    try {
        const { error } = await supabase
            .from('tokens_usuarios')
            .upsert({
                token: token,
                email: email,
                creado: new Date().toISOString()
            }, { onConflict: 'token' });
        
        if (error) {
            console.error('Error creando token de usuario:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en createTokenUsuario:', e);
        return false;
    }
}

// ============================================================
// TESTIMONIOS
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
        
        if (error) {
            console.error('Error obteniendo testimonios:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error en getTestimonios:', e);
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
        
        if (error) {
            console.error('Error obteniendo testimonio por ID:', error);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Error en getTestimonioById:', e);
        return null;
    }
}

async function createTestimonio(testimonio) {
    try {
        const { error } = await supabase
            .from('testimonios')
            .insert([testimonio]);
        
        if (error) {
            console.error('Error creando testimonio:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en createTestimonio:', e);
        return false;
    }
}

async function updateTestimonio(id, data) {
    try {
        const { error } = await supabase
            .from('testimonios')
            .update(data)
            .eq('id', id);
        
        if (error) {
            console.error('Error actualizando testimonio:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en updateTestimonio:', e);
        return false;
    }
}

async function deleteTestimonio(id) {
    try {
        const { error } = await supabase
            .from('testimonios')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error eliminando testimonio:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en deleteTestimonio:', e);
        return false;
    }
}

// ============================================================
// SERVICIOS
// ============================================================

async function getServicios() {
    try {
        const { data, error } = await supabase
            .from('servicios')
            .select('*')
            .order('orden', { ascending: true });
        
        if (error) {
            console.error('Error obteniendo servicios:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error en getServicios:', e);
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
        
        if (error) {
            console.error('Error obteniendo servicio por ID:', error);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Error en getServicioById:', e);
        return null;
    }
}

async function createServicio(servicio) {
    try {
        const { error } = await supabase
            .from('servicios')
            .insert([servicio]);
        
        if (error) {
            console.error('Error creando servicio:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en createServicio:', e);
        return false;
    }
}

async function updateServicio(id, data) {
    try {
        const { error } = await supabase
            .from('servicios')
            .update(data)
            .eq('id', id);
        
        if (error) {
            console.error('Error actualizando servicio:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en updateServicio:', e);
        return false;
    }
}

async function deleteServicio(id) {
    try {
        const { error } = await supabase
            .from('servicios')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error eliminando servicio:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en deleteServicio:', e);
        return false;
    }
}

// ============================================================
// TURNOS
// ============================================================

async function getTurnos() {
    try {
        // ⭐ CORREGIDO: sintaxis correcta para not.in
        const { data, error } = await supabase
            .from('turnos')
            .select('*')
            .not('estado', 'in', '("cancelado","cancelado_automatico")')
            .order('fecha_creacion', { ascending: false });
        
        if (error) {
            console.error('Error obteniendo turnos:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error en getTurnos:', e);
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
        
        if (error) {
            console.error('Error obteniendo turno por ID:', error);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Error en getTurnoById:', e);
        return null;
    }
}

async function getTurnosByFecha(fecha) {
    try {
        const { data, error } = await supabase
            .from('turnos')
            .select('*')
            .eq('fecha', fecha)
            .not('estado', 'in', '("cancelado","cancelado_automatico")');
        
        if (error) {
            console.error('Error obteniendo turnos por fecha:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error en getTurnosByFecha:', e);
        return [];
    }
}

async function createTurno(turno) {
    try {
        const { error } = await supabase
            .from('turnos')
            .insert([turno]);
        
        if (error) {
            console.error('Error creando turno:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en createTurno:', e);
        return false;
    }
}

async function updateTurno(id, data) {
    try {
        const { error } = await supabase
            .from('turnos')
            .update(data)
            .eq('id', id);
        
        if (error) {
            console.error('Error actualizando turno:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en updateTurno:', e);
        return false;
    }
}

async function deleteTurno(id) {
    try {
        const { error } = await supabase
            .from('turnos')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error eliminando turno:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en deleteTurno:', e);
        return false;
    }
}

// ============================================================
// EXPORTAR FUNCIONES
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
    createTokenUsuario,
    
    // Testimonios
    getTestimonios,
    getTestimonioById,
    createTestimonio,
    updateTestimonio,
    deleteTestimonio,
    
    // Servicios
    getServicios,
    getServicioById,
    createServicio,
    updateServicio,
    deleteServicio,
    
    // Turnos
    getTurnos,
    getTurnoById,
    getTurnosByFecha,
    createTurno,
    updateTurno,
    deleteTurno
};