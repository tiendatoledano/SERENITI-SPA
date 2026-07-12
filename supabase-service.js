// ============================================================
// supabase-service.js - SERVICIO DE SUPABASE
// TODOS los accesos a la base de datos se centralizan aquí
// ============================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ============================================================
// CONFIGURACIÓN DE SUPABASE
// ============================================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ERROR: Faltan variables de entorno de Supabase');
    console.error('   SUPABASE_URL:', supabaseUrl ? '✅ Configurada' : '❌ No configurada');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Configurada' : '❌ No configurada');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
console.log('✅ Conexión a Supabase establecida correctamente');

// ============================================================
// FUNCIONES DE CONFIGURACIÓN GENERAL
// ============================================================

async function setConfiguracion(clave, valor) {
    try {
        console.log(`📤 Guardando configuración ${clave}...`);
        
        const { data, error } = await supabase
            .from('configuracion')
            .upsert({ 
                clave: clave, 
                valor: valor,
                updated_at: new Date().toISOString()
            }, { 
                onConflict: 'clave'
            })
            .select();
        
        if (error) {
            console.error(`❌ Error en setConfiguracion(${clave}):`, error);
            throw error;
        }
        
        console.log(`✅ Configuración ${clave} guardada correctamente`);
        return data;
    } catch (e) {
        console.error(`❌ Error en setConfiguracion(${clave}):`, e);
        throw e;
    }
}

async function getConfiguracion(clave) {
    try {
        const { data, error } = await supabase
            .from('configuracion')
            .select('valor')
            .eq('clave', clave)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                return null;
            }
            throw error;
        }
        return data?.valor || null;
    } catch (e) {
        console.error(`Error obteniendo configuración ${clave}:`, e);
        return null;
    }
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
        console.error('Error obteniendo horarios:', e);
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
        console.log('📤 Guardando horarios en Supabase:', JSON.stringify(data, null, 2));
        
        if (!data.dias || !Array.isArray(data.dias) || data.dias.length === 0) {
            throw new Error('Debe tener al menos un día seleccionado');
        }
        if (!data.horarios || !Array.isArray(data.horarios) || data.horarios.length === 0) {
            throw new Error('Debe tener al menos un horario');
        }
        if (data.inicio === undefined || data.fin === undefined) {
            throw new Error('Rango horario incompleto');
        }
        if (data.inicio >= data.fin) {
            throw new Error('La hora de inicio debe ser menor que la de cierre');
        }
        
        const result = await setConfiguracion('horarios', data);
        console.log('✅ Horarios guardados correctamente');
        return result;
    } catch (e) {
        console.error('❌ Error en setHorarios:', e);
        throw e;
    }
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
        console.error('Error obteniendo modalidades:', e);
        return { salon_activo: true, domicilio_activo: true };
    }
}

async function setModalidades(data) {
    try {
        return await setConfiguracion('modalidades', {
            salon_activo: data.salon_activo !== false,
            domicilio_activo: data.domicilio_activo !== false
        });
    } catch (e) {
        console.error('❌ Error en setModalidades:', e);
        throw e;
    }
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
        console.error('Error obteniendo países:', e);
        return { autorizados: [], bloqueados: [], modo: 'todos', ubicacion_salon: 'Salón Serenity Spa' };
    }
}

async function setPaises(data) {
    try {
        return await setConfiguracion('paises', {
            autorizados: data.autorizados || [],
            bloqueados: data.bloqueados || [],
            modo: data.modo || 'todos',
            ubicacion_salon: data.ubicacion_salon || 'Salón Serenity Spa'
        });
    } catch (e) {
        console.error('❌ Error en setPaises:', e);
        throw e;
    }
}

// ============================================================
// CONFIGURACIÓN DE REGISTRO
// ============================================================

async function getConfiguracionRegistro() {
    try {
        const { data, error } = await supabase
            .from('configuracion_registro')
            .select('valor')
            .eq('clave', 'registro')
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                return {
                    hero: {
                        titulo: 'Comienza tu viaje de bienestar',
                        subtitulo: 'Regístrate y descubre el poder del masaje',
                        boton: 'Unirme ahora'
                    },
                    beneficios: [
                        { descripcion: 'Acceso a promociones exclusivas' },
                        { descripcion: 'Guía de bienestar personalizada' },
                        { descripcion: 'Recordatorios de tus turnos' },
                        { descripcion: 'Historial de masajes' },
                        { descripcion: 'Consejos de salud y relajación' },
                        { descripcion: 'Sorteos y eventos especiales' }
                    ],
                    conceptos: [
                        { titulo: 'Masaje Terapéutico', descripcion: 'Alivia tensiones y dolores musculares' },
                        { titulo: 'Masaje Relajante', descripcion: 'Reduce el estrés y la ansiedad' },
                        { titulo: 'Masaje Deportivo', descripcion: 'Prepara y recupera tus músculos' },
                        { titulo: 'Masaje con Piedras', descripcion: 'Calor profundo y relajación total' },
                        { titulo: 'Masaje Ayurveda', descripcion: 'Equilibra tus energías vitales' },
                        { titulo: 'Masaje Tailandés', descripcion: 'Estiramientos y energía renovada' }
                    ],
                    imagenWhatsApp: 'https://i.postimg.cc/HWzhR73W/photo-1519823551278-64ac92734fb1.jpg'
                };
            }
            throw error;
        }
        return data?.valor || {};
    } catch (e) {
        console.error('Error obteniendo configuración de registro:', e);
        return {};
    }
}

async function setConfiguracionRegistro(data) {
    try {
        const { error } = await supabase
            .from('configuracion_registro')
            .upsert({ 
                clave: 'registro', 
                valor: data,
                updated_at: new Date().toISOString()
            }, { 
                onConflict: 'clave' 
            });
        
        if (error) {
            console.error('❌ Error en setConfiguracionRegistro:', error);
            throw error;
        }
        return { success: true };
    } catch (e) {
        console.error('❌ Error en setConfiguracionRegistro:', e);
        throw e;
    }
}

// ============================================================
// PALABRAS BANEADAS
// ============================================================

async function getPalabrasBaneadas() {
    try {
        const { data, error } = await supabase
            .from('palabras_baneadas')
            .select('palabra')
            .order('palabra');
        
        if (error) throw error;
        return data.map(item => item.palabra);
    } catch (e) {
        console.error('Error obteniendo palabras baneadas:', e);
        return [];
    }
}

async function addPalabraBaneada(palabra) {
    try {
        const { error } = await supabase
            .from('palabras_baneadas')
            .insert({ palabra: palabra.toLowerCase().trim() });
        
        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Error agregando palabra baneada:', e);
        throw e;
    }
}

async function removePalabraBaneada(palabra) {
    try {
        const { error } = await supabase
            .from('palabras_baneadas')
            .delete()
            .eq('palabra', palabra.toLowerCase().trim());
        
        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Error eliminando palabra baneada:', e);
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
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error obteniendo servicios:', e);
        return [];
    }
}

async function getServicioById(id) {
    try {
        const { data, error } = await supabase
            .from('servicios')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Error obteniendo servicio:', e);
        return null;
    }
}

async function createServicio(servicio) {
    try {
        const { data, error } = await supabase
            .from('servicios')
            .insert([servicio])
            .select();
        
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Error creando servicio:', e);
        throw e;
    }
}

async function updateServicio(id, data) {
    try {
        const { error } = await supabase
            .from('servicios')
            .update(data)
            .eq('id', id);
        
        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Error actualizando servicio:', e);
        throw e;
    }
}

async function deleteServicio(id) {
    try {
        const { error } = await supabase
            .from('servicios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Error eliminando servicio:', e);
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
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error obteniendo turnos:', e);
        return [];
    }
}

async function getTurnoById(id) {
    try {
        const { data, error } = await supabase
            .from('turnos')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Error obteniendo turno:', e);
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
    } catch (e) {
        console.error('Error obteniendo turnos por fecha:', e);
        return [];
    }
}

async function createTurno(turno) {
    try {
        const { data, error } = await supabase
            .from('turnos')
            .insert([turno])
            .select();
        
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Error creando turno:', e);
        throw e;
    }
}

async function updateTurno(id, data) {
    try {
        const { error } = await supabase
            .from('turnos')
            .update(data)
            .eq('id', id);
        
        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Error actualizando turno:', e);
        throw e;
    }
}

async function deleteTurno(id) {
    try {
        const { error } = await supabase
            .from('turnos')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Error eliminando turno:', e);
        throw e;
    }
}

// ============================================================
// TESTIMONIOS
// ============================================================

async function getTestimonios(publicos = true) {
    try {
        let query = supabase.from('testimonios').select('*');
        if (publicos) {
            query = query.eq('publico', true);
        }
        const { data, error } = await query.order('fecha', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error obteniendo testimonios:', e);
        return [];
    }
}

async function getTestimonioById(id) {
    try {
        const { data, error } = await supabase
            .from('testimonios')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Error obteniendo testimonio:', e);
        return null;
    }
}

async function createTestimonio(testimonio) {
    try {
        const { data, error } = await supabase
            .from('testimonios')
            .insert([testimonio])
            .select();
        
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Error creando testimonio:', e);
        throw e;
    }
}

async function updateTestimonio(id, data) {
    try {
        const { error } = await supabase
            .from('testimonios')
            .update(data)
            .eq('id', id);
        
        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Error actualizando testimonio:', e);
        throw e;
    }
}

async function deleteTestimonio(id) {
    try {
        const { error } = await supabase
            .from('testimonios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Error eliminando testimonio:', e);
        throw e;
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
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error obteniendo usuarios:', e);
        return [];
    }
}

async function getUsuarioById(id) {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Error obteniendo usuario:', e);
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
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data;
    } catch (e) {
        console.error('Error obteniendo usuario por email:', e);
        return null;
    }
}

async function getUsuarioByToken(token) {
    try {
        if (!token) {
            return null;
        }
        
        const { data, error } = await supabase
            .from('tokens_usuarios')
            .select('email')
            .eq('token', token)
            .maybeSingle();
        
        if (error) {
            console.error('❌ Error en getUsuarioByToken:', error);
            return null;
        }
        
        if (data && data.email) {
            return await getUsuarioByEmail(data.email);
        }
        return null;
    } catch (e) {
        console.error('❌ Error en getUsuarioByToken:', e);
        return null;
    }
}

async function createUsuario(usuario) {
    try {
        const { data, error } = await supabase
            .from('usuarios')
            .insert([usuario])
            .select();
        
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Error creando usuario:', e);
        throw e;
    }
}

async function updateUsuario(id, data) {
    try {
        const { error } = await supabase
            .from('usuarios')
            .update(data)
            .eq('id', id);
        
        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Error actualizando usuario:', e);
        throw e;
    }
}

async function deleteUsuario(id) {
    try {
        const { error } = await supabase
            .from('usuarios')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Error eliminando usuario:', e);
        throw e;
    }
}

// ============================================================
// TOKENS DE USUARIOS
// ============================================================

async function createTokenUsuario(token, email) {
    try {
        if (!token || !email) {
            throw new Error('Token y email son requeridos');
        }
        
        console.log(`📝 Creando token para ${email}...`);
        
        const { error } = await supabase
            .from('tokens_usuarios')
            .insert({ 
                token: token,
                email: email,
                created_at: new Date().toISOString()
            });
        
        if (error) {
            console.error('❌ Error en createTokenUsuario:', error);
            throw error;
        }
        console.log(`✅ Token creado para ${email}`);
        return { success: true };
    } catch (e) {
        console.error('❌ Error en createTokenUsuario:', e);
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
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data;
    } catch (e) {
        console.error('Error obteniendo código de verificación:', e);
        return null;
    }
}

async function upsertCodigoVerificacion(email, data) {
    try {
        if (!email || !data) {
            throw new Error('Email y datos son requeridos');
        }
        
        console.log(`📝 Guardando código para ${email}...`);
        
        const { error } = await supabase
            .from('codigos_verificacion')
            .upsert({ 
                email: email,
                codigo: data.codigo,
                expiracion: data.expiracion,
                intentos: data.intentos || 0,
                nombre: data.nombre || null,
                created_at: new Date().toISOString()
            }, { 
                onConflict: 'email' 
            });
        
        if (error) {
            console.error('❌ Error en upsertCodigoVerificacion:', error);
            throw error;
        }
        console.log(`✅ Código guardado para ${email}`);
        return { success: true };
    } catch (e) {
        console.error('❌ Error en upsertCodigoVerificacion:', e);
        throw e;
    }
}

async function deleteCodigoVerificacion(email) {
    try {
        const { error } = await supabase
            .from('codigos_verificacion')
            .delete()
            .eq('email', email);
        
        if (error) throw error;
        return { success: true };
    } catch (e) {
        console.error('Error eliminando código de verificación:', e);
        throw e;
    }
}

// ============================================================
// BLOQUEOS
// ============================================================

async function getBloqueosActivos() {
    try {
        const { data, error } = await supabase
            .from('bloqueos')
            .select('*')
            .order('fecha', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Error obteniendo bloqueos:', e);
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
        return { success: true };
    } catch (e) {
        console.error('Error eliminando bloqueo por IP:', e);
        throw e;
    }
}

// ============================================================
// EXPORTAR TODAS LAS FUNCIONES
// ============================================================

module.exports = {
    // Conexión
    supabase,
    
    // Configuración general
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
    
    // Configuración de registro
    getConfiguracionRegistro,
    setConfiguracionRegistro,
    
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
    
    // Turnos
    getTurnos,
    getTurnoById,
    getTurnosByFecha,
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
    getUsuarioById,
    getUsuarioByEmail,
    getUsuarioByToken,
    createUsuario,
    updateUsuario,
    deleteUsuario,
    createTokenUsuario,
    
    // Códigos de verificación
    getCodigoVerificacion,
    upsertCodigoVerificacion,
    deleteCodigoVerificacion,
    
    // Bloqueos
    getBloqueosActivos,
    deleteBloqueoByIP
};