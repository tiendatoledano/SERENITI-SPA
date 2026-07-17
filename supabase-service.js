// ============================================================
// supabase-service.js - SERVICIO DE SUPABASE
// ============================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ============================================================
// CONFIGURACIÓN
// ============================================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ERROR: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configuradas');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('✅ Supabase inicializado correctamente');

// ============================================================
// USUARIOS
// ============================================================

async function getUsuarioByEmail(email) {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', email)
            .maybeSingle();
        
        if (error) {
            console.error('Error getting usuario by email:', error);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Error en getUsuarioByEmail:', e);
        return null;
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
            console.error('Error getting usuario by id:', error);
            return null;
        }
        return data;
    } catch (e) {
        console.error('Error en getUsuarioById:', e);
        return null;
    }
}

async function createUsuario(usuario) {
    try {
        // Solo campos que existen en la tabla
        const { id, nombre, email, verificado, fecha_registro, bloqueado, motivo_bloqueo, avatar } = usuario;
        
        const { data, error } = await supabase
            .from('usuarios')
            .insert({
                id,
                nombre,
                email,
                verificado: verificado || false,
                fecha_registro: fecha_registro || new Date().toISOString(),
                bloqueado: bloqueado || false,
                motivo_bloqueo: motivo_bloqueo || null,
                avatar: avatar || null
            })
            .select()
            .single();
        
        if (error) {
            console.error('Error creating usuario:', error);
            throw error;
        }
        return data;
    } catch (e) {
        console.error('Error en createUsuario:', e);
        throw e;
    }
}

async function updateUsuario(id, updates) {
    try {
        // Filtrar campos undefined
        const cleanUpdates = {};
        const allowedFields = ['nombre', 'email', 'verificado', 'bloqueado', 'motivo_bloqueo', 'avatar'];
        
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                cleanUpdates[key] = updates[key];
            }
        }
        
        const { data, error } = await supabase
            .from('usuarios')
            .update(cleanUpdates)
            .eq('id', id)
            .select()
            .single();
        
        if (error) {
            console.error('Error updating usuario:', error);
            throw error;
        }
        return data;
    } catch (e) {
        console.error('Error en updateUsuario:', e);
        throw e;
    }
}

async function getUsuarios() {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .order('fecha_registro', { ascending: false });
        
        if (error) {
            console.error('Error getting usuarios:', error);
            return [];
        }
        return data || [];
    } catch (e) {
        console.error('Error en getUsuarios:', e);
        return [];
    }
}

async function deleteUsuario(id) {
    try {
        const { error } = await supabase
            .from('usuarios')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting usuario:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en deleteUsuario:', e);
        throw e;
    }
}

async function getUsuarioByToken(token) {
    try {
        const ahora = Date.now();
        
        const { data, error } = await supabase
            .from('tokens_usuarios')
            .select('usuario_id, usuarios(*)')
            .eq('token', token)
            .gt('expiracion', ahora)
            .maybeSingle();
        
        if (error || !data) {
            return null;
        }
        return data.usuarios;
    } catch (e) {
        console.error('Error en getUsuarioByToken:', e);
        return null;
    }
}

async function createTokenUsuario(token, email) {
    try {
        const expiracion = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 días
        
        const { error } = await supabase
            .from('tokens_usuarios')
            .insert({
                token,
                email,
                expiracion,
                creado: new Date().toISOString()
            });
        
        if (error) {
            console.error('Error creating token:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en createTokenUsuario:', e);
        throw e;
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
            console.error('Error getting codigo:', error);
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
                email,
                codigo: data.codigo,
                expiracion: data.expiracion,
                intentos: data.intentos || 0,
                nombre: data.nombre || ''
            });
        
        if (error) {
            console.error('Error upserting codigo:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en upsertCodigoVerificacion:', e);
        throw e;
    }
}

async function deleteCodigoVerificacion(email) {
    try {
        const { error } = await supabase
            .from('codigos_verificacion')
            .delete()
            .eq('email', email);
        
        if (error) {
            console.error('Error deleting codigo:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en deleteCodigoVerificacion:', e);
        throw e;
    }
}

// ============================================================
// TESTIMONIOS
// ============================================================

async function getTestimonios(publico = true) {
    try {
        let query = supabase
            .from('testimonios')
            .select('*')
            .order('fecha', { ascending: false });
        
        if (publico) {
            query = query.eq('publico', true);
        }
        
        const { data, error } = await query;
        
        if (error) {
            console.error('Error getting testimonios:', error);
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
            console.error('Error getting testimonio:', error);
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
            .insert(testimonio);
        
        if (error) {
            console.error('Error creating testimonio:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en createTestimonio:', e);
        throw e;
    }
}

async function updateTestimonio(id, updates) {
    try {
        const { error } = await supabase
            .from('testimonios')
            .update(updates)
            .eq('id', id);
        
        if (error) {
            console.error('Error updating testimonio:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en updateTestimonio:', e);
        throw e;
    }
}

async function deleteTestimonio(id) {
    try {
        const { error } = await supabase
            .from('testimonios')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting testimonio:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en deleteTestimonio:', e);
        throw e;
    }
}

// ============================================================
// TURNOS
// ============================================================

async function getTurnos() {
    try {
        const { data, error } = await supabase
            .from('turnos')
            .select('*')
            .order('fecha_creacion', { ascending: false });
        
        if (error) {
            console.error('Error getting turnos:', error);
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
            console.error('Error getting turno:', error);
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
            .eq('fecha', fecha);
        
        if (error) {
            console.error('Error getting turnos by fecha:', error);
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
            .insert(turno);
        
        if (error) {
            console.error('Error creating turno:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en createTurno:', e);
        throw e;
    }
}

async function updateTurno(id, updates) {
    try {
        const { error } = await supabase
            .from('turnos')
            .update(updates)
            .eq('id', id);
        
        if (error) {
            console.error('Error updating turno:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en updateTurno:', e);
        throw e;
    }
}

async function deleteTurno(id) {
    try {
        const { error } = await supabase
            .from('turnos')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting turno:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en deleteTurno:', e);
        throw e;
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
            console.error('Error getting servicios:', error);
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
            console.error('Error getting servicio:', error);
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
            .insert(servicio);
        
        if (error) {
            console.error('Error creating servicio:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en createServicio:', e);
        throw e;
    }
}

async function updateServicio(id, updates) {
    try {
        const { error } = await supabase
            .from('servicios')
            .update(updates)
            .eq('id', id);
        
        if (error) {
            console.error('Error updating servicio:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en updateServicio:', e);
        throw e;
    }
}

async function deleteServicio(id) {
    try {
        const { error } = await supabase
            .from('servicios')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting servicio:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en deleteServicio:', e);
        throw e;
    }
}

// ============================================================
// CONFIGURACIÓN
// ============================================================

async function getConfiguracion(key) {
    try {
        const { data, error } = await supabase
            .from('configuracion')
            .select('*')
            .eq('clave', key)
            .maybeSingle();
        
        if (error) {
            console.error('Error getting config:', error);
            return null;
        }
        return data?.valor || null;
    } catch (e) {
        console.error('Error en getConfiguracion:', e);
        return null;
    }
}

async function setConfiguracion(key, valor) {
    try {
        const { error } = await supabase
            .from('configuracion')
            .upsert({
                clave: key,
                valor: valor,
                actualizado: new Date().toISOString()
            });
        
        if (error) {
            console.error('Error setting config:', error);
            throw error;
        }
        return true;
    } catch (e) {
        console.error('Error en setConfiguracion:', e);
        throw e;
    }
}

async function getConfiguracionRegistro() {
    const valor = await getConfiguracion('registro');
    return valor || {};
}

async function setConfiguracionRegistro(valor) {
    return await setConfiguracion('registro', valor);
}

// ============================================================
// HORARIOS
// ============================================================

async function getHorarios() {
    const valor = await getConfiguracion('horarios');
    return valor || {
        dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'],
        horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
        inicio: 8,
        fin: 20
    };
}

async function setHorarios(data) {
    return await setConfiguracion('horarios', data);
}

// ============================================================
// MODALIDADES
// ============================================================

async function getModalidades() {
    const valor = await getConfiguracion('modalidades');
    return valor || {
        salon_activo: true,
        domicilio_activo: true
    };
}

async function setModalidades(data) {
    return await setConfiguracion('modalidades', data);
}

// ============================================================
// PAÍSES
// ============================================================

async function getPaises() {
    const valor = await getConfiguracion('paises');
    return valor || {
        autorizados: [],
        bloqueados: [],
        modo: 'todos',
        ubicacion_salon: 'Salón Serenity Spa'
    };
}

async function setPaises(data) {
    return await setConfiguracion('paises', data);
}

// ============================================================
// PALABRAS BANEADAS
// ============================================================

async function getPalabrasBaneadas() {
    const valor = await getConfiguracion('palabras_baneadas');
    return valor || [];
}

async function addPalabraBaneada(palabra) {
    const actual = await getPalabrasBaneadas();
    if (!actual.includes(palabra)) {
        actual.push(palabra);
        await setConfiguracion('palabras_baneadas', actual);
    }
    return true;
}

async function removePalabraBaneada(palabra) {
    const actual = await getPalabrasBaneadas();
    const filtrado = actual.filter(p => p !== palabra);
    await setConfiguracion('palabras_baneadas', filtrado);
    return true;
}

// ============================================================
// EXPORTAR
// ============================================================
module.exports = {
    // Usuarios
    getUsuarioByEmail,
    getUsuarioById,
    createUsuario,
    updateUsuario,
    getUsuarios,
    deleteUsuario,
    getUsuarioByToken,
    createTokenUsuario,
    
    // Códigos de verificación
    getCodigoVerificacion,
    upsertCodigoVerificacion,
    deleteCodigoVerificacion,
    
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
    
    // Servicios
    getServicios,
    getServicioById,
    createServicio,
    updateServicio,
    deleteServicio,
    
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
    removePalabraBaneada
};