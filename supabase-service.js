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

console.log('✅ Supabase inicializado');

// ============================================================
// ⭐ HORARIOS
// ============================================================

async function getHorarios() {
    try {
        const { data, error } = await supabase
            .from('configuracion')
            .select('contenido')
            .eq('tipo', 'horarios')
            .maybeSingle();
        
        if (error) {
            console.error('Error obteniendo horarios:', error);
            return {
                dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
                horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
                inicio: 8,
                fin: 20
            };
        }
        
        const config = data?.contenido || null;
        
        if (!config || !config.dias || config.dias.length === 0) {
            return {
                dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
                horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
                inicio: 8,
                fin: 20
            };
        }
        
        return {
            dias: config.dias.map(d => d.toLowerCase()),
            horarios: config.horarios || ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
            inicio: config.inicio || 8,
            fin: config.fin || 20
        };
    } catch (e) {
        console.error('Error en getHorarios:', e);
        return {
            dias: ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
            horarios: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
            inicio: 8,
            fin: 20
        };
    }
}

async function setHorarios(data) {
    try {
        const datosLimpios = {
            dias: data.dias ? data.dias.map(d => d.toLowerCase()) : ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'],
            horarios: data.horarios || ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
            inicio: data.inicio || 8,
            fin: data.fin || 20
        };
        
        const { error } = await supabase
            .from('configuracion')
            .upsert({
                tipo: 'horarios',
                contenido: datosLimpios
            }, { onConflict: 'tipo' });
        
        if (error) {
            console.error('Error guardando horarios:', error);
            return false;
        }
        return true;
    } catch (e) {
        console.error('Error en setHorarios:', e);
        return false;
    }
}

// ============================================================
// MODALIDADES
// ============================================================

async function getModalidades() {
    try {
        const { data, error } = await supabase
            .from('configuracion')
            .select('contenido')
            .eq('tipo', 'modalidades')
            .maybeSingle();
        
        if (error || !data) {
            return { salon_activo: true, domicilio_activo: true };
        }
        
        const config = data.contenido || {};
        return {
            salon_activo: config.salon_activo !== false,
            domicilio_activo: config.domicilio_activo !== false
        };
    } catch (e) {
        return { salon_activo: true, domicilio_activo: true };
    }
}

// ============================================================
// PAÍSES
// ============================================================

async function getPaises() {
    try {
        const { data, error } = await supabase
            .from('configuracion')
            .select('contenido')
            .eq('tipo', 'paises')
            .maybeSingle();
        
        if (error || !data) {
            return { autorizados: [], bloqueados: [], modo: 'todos', ubicacion_salon: 'Salón Serenity Spa' };
        }
        
        const config = data.contenido || {};
        return {
            autorizados: config.autorizados || [],
            bloqueados: config.bloqueados || [],
            modo: config.modo || 'todos',
            ubicacion_salon: config.ubicacion_salon || 'Salón Serenity Spa'
        };
    } catch (e) {
        return { autorizados: [], bloqueados: [], modo: 'todos', ubicacion_salon: 'Salón Serenity Spa' };
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
            .eq('fecha', fecha);
        
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
// USUARIOS (básico)
// ============================================================

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
        
        const { data: usuario, error: userError } = await supabase
            .from('usuarios')
            .select('*')
            .eq('email', tokenData.email)
            .maybeSingle();
        
        if (userError) {
            console.error('Error obteniendo usuario:', userError);
            return null;
        }
        return usuario;
    } catch (e) {
        console.error('Error en getUsuarioByToken:', e);
        return null;
    }
}

// ============================================================
// EXPORTAR
// ============================================================

module.exports = {
    getHorarios,
    setHorarios,
    getModalidades,
    getPaises,
    getTurnos,
    getTurnoById,
    getTurnosByFecha,
    createTurno,
    updateTurno,
    deleteTurno,
    getUsuarioByToken
};