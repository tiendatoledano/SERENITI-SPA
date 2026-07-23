// ============================================================
// server.js - SERVIDOR PRINCIPAL CON SUPABASE (VERSIÓN FINAL CON PAGOS)
// ============================================================

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// ============================================================
// ⭐ DETECTAR CARPETA BASE DONDE ESTÁN LOS HTML
// ============================================================
function detectBaseDir() {
    const possiblePaths = [
        __dirname,
        path.join(__dirname, 'src'),
        path.join(__dirname, 'public'),
        path.join(__dirname, '..'),
        path.join(__dirname, 'dist'),
        path.join(__dirname, 'build'),
    ];

    for (const dir of possiblePaths) {
        const testPath = path.join(dir, 'index.html');
        if (fs.existsSync(testPath)) {
            console.log(`✅ Archivos HTML encontrados en: ${dir}`);
            return dir;
        }
    }

    console.warn(`⚠️ No se encontró index.html, usando: ${__dirname}`);
    return __dirname;
}

const BASE_DIR = detectBaseDir();
console.log(`📂 Sirviendo archivos desde: ${BASE_DIR}`);

// ============================================================
// ⭐ IMPORTAR SUPABASE
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
console.log('✅ Supabase inicializado en server.js');

// Importar servicios
const db = require('./supabase-service');
const security = require('./security');

// ============================================================
// VERIFICAR CONFIGURACIÓN DE ENTORNO
// ============================================================
console.log('🔐 ==========================================');
console.log('🔐 VERIFICANDO VARIABLES DE ENTORNO');
console.log('🔐 ==========================================');
console.log('📌 SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Configurada' : '❌ No configurada');
console.log('📌 SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurada' : '❌ No configurada');
console.log('📌 EMAILJS_PUBLIC_KEY:', process.env.EMAILJS_PUBLIC_KEY ? '✅ Configurada' : '❌ No configurada');
console.log('📌 EMAILJS_SERVICE_ID:', process.env.EMAILJS_SERVICE_ID ? '✅ Configurada' : '❌ No configurada');
console.log('📌 EMAILJS_TEMPLATE_ID:', process.env.EMAILJS_TEMPLATE_ID ? '✅ Configurada' : '❌ No configurada');
console.log('📌 PORT:', process.env.PORT || '5001');
console.log('📌 BASE_DIR:', BASE_DIR);
console.log('🔐 ==========================================');






// ============================================================
// CONFIGURACIÓN DE PAGOS - VARIABLES DE ENTORNO (PROTEGIDAS)
// ============================================================
function getPagoConfigFromEnv() {
    return {
        transfermovil: {
            numero: process.env.TRANSFERMOVIL_NUMERO || '53571569',
            nombre: process.env.TRANSFERMOVIL_NOMBRE || 'Serenity Spa',
            activo: process.env.TRANSFERMOVIL_ACTIVO !== 'false'
        },
        enzona: {
            numero: process.env.ENZONA_NUMERO || '53571569',
            nombre: process.env.ENZONA_NOMBRE || 'Serenity Spa',
            activo: process.env.ENZONA_ACTIVO !== 'false'
        },
        cuentaBancaria: {
            numero: process.env.CUENTA_BANCARIA_NUMERO || '1234-5678-2234-2344',
            banco: process.env.CUENTA_BANCARIA_BANCO || 'Banco de Crédito y Comercio'
        },
        telefonoVerificacion: process.env.TELEFONO_VERIFICACION || '53571569',
        telefonoNotificaciones: process.env.TELEFONO_NOTIFICACIONES || '53571569',
        monto: {
            default: parseFloat(process.env.PAGO_MONTO_DEFAULT) || 25.00,
            moneda: process.env.PAGO_MONEDA || 'CUP'
        },
        _meta: {
            source: 'env',
            updatedAt: new Date().toISOString(),
            protected: true,
            encrypted: true
        }
    };
}

// ============================================================
// ENDPOINTS DE CONFIGURACIÓN DE PAGOS
// ============================================================

// Endpoint público - solo información necesaria para el cliente
app.get('/api/pago/config', async (req, res) => {
    try {
        let config = null;
        let source = 'env';
        
        try {
            const supabaseConfig = await db.getConfiguracion('pago');
            if (supabaseConfig && supabaseConfig.transfermovil) {
                config = supabaseConfig;
                source = 'supabase';
            }
        } catch (e) {
            console.warn('⚠️ Error obteniendo config de pago de Supabase:', e);
        }
        
        if (!config) {
            config = getPagoConfigFromEnv();
            source = 'env';
        }
        
        // Devolver solo datos necesarios para el cliente
        const publicConfig = {
            transfermovil: {
                numero: config.transfermovil?.numero || '53571569',
                nombre: config.transfermovil?.nombre || 'Serenity Spa',
                activo: config.transfermovil?.activo !== false
            },
            enzona: {
                numero: config.enzona?.numero || '53571569',
                nombre: config.enzona?.nombre || 'Serenity Spa',
                activo: config.enzona?.activo !== false
            },
            cuentaBancaria: {
                numero: config.cuentaBancaria?.numero || '1234-5678-2234-2344',
                banco: config.cuentaBancaria?.banco || 'Banco de Crédito y Comercio'
            },
            telefonoVerificacion: config.telefonoVerificacion || '53571569',
            monto: {
                default: config.monto?.default || 25.00,
                moneda: config.monto?.moneda || 'CUP'
            },
            _source: source,
            _protected: true
        };
        
        res.json(publicConfig);
    } catch (error) {
        console.error('❌ Error obteniendo config de pago:', error);
        const fallback = getPagoConfigFromEnv();
        res.json({
            transfermovil: {
                numero: fallback.transfermovil.numero,
                nombre: fallback.transfermovil.nombre,
                activo: fallback.transfermovil.activo
            },
            enzona: {
                numero: fallback.enzona.numero,
                nombre: fallback.enzona.nombre,
                activo: fallback.enzona.activo
            },
            cuentaBancaria: {
                numero: fallback.cuentaBancaria.numero,
                banco: fallback.cuentaBancaria.banco
            },
            telefonoVerificacion: fallback.telefonoVerificacion,
            monto: {
                default: fallback.monto.default,
                moneda: fallback.monto.moneda
            },
            _source: 'env_fallback',
            _protected: true
        });
    }
});

// Endpoint protegido - solo administradores pueden modificar
app.put('/api/pago/config', verifyAuth, async (req, res) => {
    try {
        const { transfermovil, enzona, cuentaBancaria, telefonoVerificacion, telefonoNotificaciones, monto } = req.body;
        
        // Validar datos
        if (transfermovil) {
            if (transfermovil.numero && !/^\d{1,20}$/.test(transfermovil.numero.replace(/\D/g, ''))) {
                return res.status(400).json({ error: 'Número de Transfermóvil inválido' });
            }
            if (transfermovil.nombre && transfermovil.nombre.trim().length < 2) {
                return res.status(400).json({ error: 'Nombre de Transfermóvil inválido' });
            }
        }
        
        if (enzona) {
            if (enzona.numero && !/^\d{1,20}$/.test(enzona.numero.replace(/\D/g, ''))) {
                return res.status(400).json({ error: 'Número de EnZona inválido' });
            }
            if (enzona.nombre && enzona.nombre.trim().length < 2) {
                return res.status(400).json({ error: 'Nombre de EnZona inválido' });
            }
        }
        
        if (cuentaBancaria) {
            if (cuentaBancaria.numero && cuentaBancaria.numero.trim().length < 5) {
                return res.status(400).json({ error: 'Número de cuenta bancaria inválido' });
            }
            if (cuentaBancaria.banco && cuentaBancaria.banco.trim().length < 2) {
                return res.status(400).json({ error: 'Nombre del banco inválido' });
            }
        }
        
        if (telefonoVerificacion && !/^\d{1,20}$/.test(telefonoVerificacion.replace(/\D/g, ''))) {
            return res.status(400).json({ error: 'Teléfono de verificación inválido' });
        }
        
        if (monto) {
            if (monto.default && (isNaN(monto.default) || monto.default <= 0)) {
                return res.status(400).json({ error: 'Monto inválido' });
            }
            if (monto.moneda && monto.moneda.trim().length < 1) {
                return res.status(400).json({ error: 'Moneda inválida' });
            }
        }
        
        const envConfig = getPagoConfigFromEnv();
        const newConfig = {
            transfermovil: {
                numero: transfermovil?.numero || envConfig.transfermovil.numero,
                nombre: transfermovil?.nombre || envConfig.transfermovil.nombre,
                activo: transfermovil?.activo !== undefined ? transfermovil.activo : envConfig.transfermovil.activo
            },
            enzona: {
                numero: enzona?.numero || envConfig.enzona.numero,
                nombre: enzona?.nombre || envConfig.enzona.nombre,
                activo: enzona?.activo !== undefined ? enzona.activo : envConfig.enzona.activo
            },
            cuentaBancaria: {
                numero: cuentaBancaria?.numero || envConfig.cuentaBancaria.numero,
                banco: cuentaBancaria?.banco || envConfig.cuentaBancaria.banco
            },
            telefonoVerificacion: telefonoVerificacion || envConfig.telefonoVerificacion,
            telefonoNotificaciones: telefonoNotificaciones || envConfig.telefonoNotificaciones,
            monto: {
                default: monto?.default || envConfig.monto.default,
                moneda: monto?.moneda || envConfig.monto.moneda
            },
            _meta: {
                updatedAt: new Date().toISOString(),
                updatedBy: req.ip || 'admin',
                version: '2.0'
            }
        };
        
        await db.setConfiguracion('pago', newConfig);
        
        console.log('✅ Configuración de pagos actualizada por admin');
        
        res.json({
            success: true,
            message: 'Configuración de pagos actualizada correctamente',
            config: {
                transfermovil: {
                    numero: newConfig.transfermovil.numero,
                    nombre: newConfig.transfermovil.nombre,
                    activo: newConfig.transfermovil.activo
                },
                enzona: {
                    numero: newConfig.enzona.numero,
                    nombre: newConfig.enzona.nombre,
                    activo: newConfig.enzona.activo
                },
                cuentaBancaria: {
                    numero: newConfig.cuentaBancaria.numero,
                    banco: newConfig.cuentaBancaria.banco
                },
                telefonoVerificacion: newConfig.telefonoVerificacion,
                monto: {
                    default: newConfig.monto.default,
                    moneda: newConfig.monto.moneda
                }
            },
            _protected: true
        });
    } catch (error) {
        console.error('❌ Error actualizando config de pago:', error);
        res.status(500).json({ error: 'Error al actualizar configuración de pago' });
    }
});

// Endpoint para sincronizar desde variables de entorno
app.post('/api/pago/config/sync', verifyAuth, async (req, res) => {
    try {
        const envConfig = getPagoConfigFromEnv();
        await db.setConfiguracion('pago', envConfig);
        
        console.log('✅ Configuración de pagos sincronizada desde variables de entorno');
        
        res.json({
            success: true,
            message: 'Configuración sincronizada desde variables de entorno',
            config: {
                transfermovil: {
                    numero: envConfig.transfermovil.numero,
                    nombre: envConfig.transfermovil.nombre,
                    activo: envConfig.transfermovil.activo
                },
                enzona: {
                    numero: envConfig.enzona.numero,
                    nombre: envConfig.enzona.nombre,
                    activo: envConfig.enzona.activo
                },
                cuentaBancaria: {
                    numero: envConfig.cuentaBancaria.numero,
                    banco: envConfig.cuentaBancaria.banco
                },
                telefonoVerificacion: envConfig.telefonoVerificacion,
                monto: {
                    default: envConfig.monto.default,
                    moneda: envConfig.monto.moneda
                }
            },
            _protected: true
        });
    } catch (error) {
        console.error('❌ Error sincronizando config de pago:', error);
        res.status(500).json({ error: 'Error al sincronizar configuración de pago' });
    }
});

// ============================================================
// TURNOS - CON SISTEMA DE PAGO Y CÓDIGO DE VERIFICACIÓN
// ============================================================

app.post('/turnos', async (req, res) => {
    try {
        const { 
            nombre, telefono, massageType, dia, hora, codigoPais, 
            ubicacion, tipoServicio, fecha, ip, precio,
            metodoPago, metodoPagoNombre, comprobante, monto, estadoPago
        } = req.body;
        
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
        
        // Generar código de cancelación (que servirá como código de verificación)
        const codigoCancelacion = Math.random().toString(36).substring(2, 8).toUpperCase();
        const clientIP = ip || security.getClientIP(req) || 'N/A';
        
        // Obtener usuario autenticado
        let usuarioId = null;
        let usuarioNombre = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const usuario = await db.getUsuarioByToken(token);
                if (usuario) {
                    usuarioId = usuario.id;
                    usuarioNombre = usuario.nombre;
                    console.log(`✅ Turno asociado al usuario: ${usuario.nombre} (${usuario.id})`);
                }
            } catch (e) {
                console.warn('⚠️ No se pudo obtener usuario del token:', e);
            }
        }
        
        // Buscar precio del servicio
        let precioFinal = precio || '';
        if (!precioFinal && massageType) {
            try {
                const { data: servicios } = await supabase
                    .from('servicios')
                    .select('precio')
                    .ilike('nombre', `%${massageType}%`)
                    .limit(1);
                if (servicios && servicios.length > 0 && servicios[0].precio) {
                    precioFinal = servicios[0].precio;
                }
            } catch (e) {}
        }
        
        // Obtener configuración de pago para el monto
        let montoPago = monto || 0;
        if (!montoPago) {
            try {
                const config = await db.getConfiguracion('pago');
                if (config && config.monto) {
                    montoPago = config.monto.default || 25.00;
                }
            } catch (e) {}
        }
        
        // Construir el turno con campos de pago
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
            codigo_verificacion: codigoCancelacion, // El mismo código para verificación
            ip: clientIP,
            conteo_bloqueos: 0,
            bloqueado: false,
            estado: 'pendiente',
            confirmado: false,
            precio: precioFinal,
            metodo_pago: metodoPago || 'transfermovil',
            metodo_pago_nombre: metodoPagoNombre || 'Transfermóvil',
            comprobante_pago: comprobante || '',
            monto_pago: montoPago,
            estado_pago: estadoPago || 'pendiente_verificacion'
        };
        
        if (usuarioId) {
            nuevoTurno.usuario_id = usuarioId;
        } else {
            console.warn('⚠️ Turno creado sin usuario_id (usuario no autenticado)');
        }
        
        console.log('📝 Creando turno con código de verificación:', codigoCancelacion);
        
        try {
            await db.createTurno(nuevoTurno);
            return res.status(201).json({
                mensaje: 'Turno reservado exitosamente',
                turno: nuevoTurno,
                codigoCancelacion: codigoCancelacion,
                codigoVerificacion: codigoCancelacion,
                usuario_id: usuarioId
            });
        } catch (error) {
            console.error('❌ Error creando turno:', error);
            
            if (error.code === 'PGRST204' && error.message && error.message.includes('column')) {
                console.error('❌ Las columnas de pago no existen en la tabla turnos.');
                console.error('❌ Ejecuta la migración SQL para agregar las columnas necesarias.');
                return res.status(500).json({ 
                    error: 'Error de configuración: Las columnas de pago no están disponibles en la base de datos. Contacta al administrador.',
                    details: error.message
                });
            }
            throw error;
        }
        
    } catch (error) {
        console.error('❌ Error creando turno:', error);
        res.status(500).json({ error: 'Error al crear el turno: ' + error.message });
    }
});

// ============================================================
// BUSCAR TURNO POR CÓDIGO DE VERIFICACIÓN (para admin)
// ============================================================
app.get('/api/turnos/buscar-por-codigo/:codigo', verifyAuth, async (req, res) => {
    try {
        const codigo = req.params.codigo.toUpperCase();
        
        if (!codigo || codigo.length < 4) {
            return res.status(400).json({ error: 'Código de verificación inválido' });
        }
        
        // Buscar por código de verificación o código de cancelación
        const { data: turnos, error } = await supabase
            .from('turnos')
            .select('*')
            .or(`codigo_verificacion.eq.${codigo},codigo_cancelacion.eq.${codigo}`)
            .limit(1);
        
        if (error) {
            console.error('Error buscando turno por código:', error);
            return res.status(500).json({ error: 'Error al buscar el turno' });
        }
        
        if (!turnos || turnos.length === 0) {
            return res.status(404).json({ error: 'No se encontró ningún turno con ese código de verificación' });
        }
        
        const turno = turnos[0];
        
        // Obtener imagen del servicio
        let imagen = null;
        if (turno.massage_type) {
            try {
                const { data: servicios } = await supabase
                    .from('servicios')
                    .select('imagen_web, imagen_whatsapp')
                    .ilike('nombre', `%${turno.massage_type}%`)
                    .limit(1);
                if (servicios && servicios.length > 0) {
                    imagen = servicios[0].imagen_whatsapp || servicios[0].imagen_web || null;
                }
            } catch (e) {}
        }
        
        res.json({
            success: true,
            turno: {
                ...turno,
                imagen: imagen
            }
        });
        
    } catch (error) {
        console.error('❌ Error buscando turno por código:', error);
        res.status(500).json({ error: 'Error al buscar el turno' });
    }
});

// ============================================================
// CONFIRMAR PAGO Y ENVIAR WHATSAPP (para admin)
// ============================================================
app.post('/api/turnos/confirmar-pago/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { codigoVerificacion } = req.body;
        
        const turno = await db.getTurnoById(id);
        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        // Verificar que el código coincida
        if (turno.codigo_verificacion !== codigoVerificacion && turno.codigo_cancelacion !== codigoVerificacion) {
            return res.status(400).json({ error: 'El código de verificación no coincide' });
        }
        
        // Actualizar estado del pago
        await db.updateTurno(id, {
            estado_pago: 'confirmado',
            estado: 'confirmado',
            confirmado: true,
            fecha_confirmacion: new Date().toISOString()
        });
        
        // Preparar mensaje de WhatsApp con imagen
        let imagenWhatsApp = '';
        let nombreServicio = turno.massage_type || 'Masaje';
        
        try {
            const { data: servicios } = await supabase
                .from('servicios')
                .select('imagen_whatsapp, imagen_web')
                .ilike('nombre', `%${nombreServicio}%`)
                .limit(1);
            if (servicios && servicios.length > 0) {
                imagenWhatsApp = servicios[0].imagen_whatsapp || servicios[0].imagen_web || '';
            }
        } catch (e) {
            console.warn('⚠️ Error buscando imagen del servicio:', e);
        }
        
        if (!imagenWhatsApp) {
            imagenWhatsApp = 'https://i.postimg.cc/Hct3ps1K/photo-1519823551278-64ac92734fb1.jpg';
        }
        
        const mensaje = `✅ *PAGO CONFIRMADO - SERENITY SPA*
        
Hola *${turno.nombre}*, ¡Gracias por tu pago! ✨

✅ *RESERVA CONFIRMADA*
📅 *Día:* ${turno.dia}
📆 *Fecha:* ${turno.fecha}
⏰ *Hora:* ${turno.hora}:00 hs
💆‍♂️ *Masaje:* ${turno.massage_type || 'Masaje'}
📍 ${turno.ubicacion || 'Serenity Spa'}

💳 *Pago confirmado*
🧾 *Comprobante:* ${turno.comprobante_pago || 'N/A'}
💵 *Monto:* ${turno.monto_pago || '0.00'} CUP

🔑 *Código de verificación:* ${turno.codigo_verificacion || turno.codigo_cancelacion}

🌸 Te esperamos en Serenity Spa.
⏱️ Cancelá con 4hs de anticipación.

*Equipo Serenity Spa* 🌿`;
        
        const numero = `${turno.codigo_pais || '53'}${turno.telefono}`;
        const whatsappUrl = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
        
        // Guardar que se envió WhatsApp
        await db.updateTurno(id, { confirmado_whatsapp: true });
        
        res.json({
            success: true,
            mensaje: 'Pago confirmado y mensaje de WhatsApp preparado',
            numero: numero,
            whatsappUrl: whatsappUrl,
            imagen: imagenWhatsApp,
            mensajeTexto: mensaje,
            turno: turno
        });
        
    } catch (error) {
        console.error('❌ Error confirmando pago:', error);
        res.status(500).json({ error: 'Error al confirmar el pago' });
    }
});

// ============================================================
// ENVIAR WHATSAPP DE CONFIRMACIÓN (nuevo endpoint para admin)
// ============================================================
app.post('/api/turnos/enviar-whatsapp-confirmacion/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const turno = await db.getTurnoById(id);
        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        let imagenWhatsApp = '';
        let nombreServicio = turno.massage_type || 'Masaje';
        
        try {
            const { data: servicios } = await supabase
                .from('servicios')
                .select('imagen_whatsapp, imagen_web')
                .ilike('nombre', `%${nombreServicio}%`)
                .limit(1);
            if (servicios && servicios.length > 0) {
                imagenWhatsApp = servicios[0].imagen_whatsapp || servicios[0].imagen_web || '';
            }
        } catch (e) {
            console.warn('⚠️ Error buscando imagen del servicio:', e);
        }
        
        if (!imagenWhatsApp) {
            imagenWhatsApp = 'https://i.postimg.cc/Hct3ps1K/photo-1519823551278-64ac92734fb1.jpg';
        }
        
        const mensaje = `✅ *PAGO CONFIRMADO - SERENITY SPA*
        
Hola *${turno.nombre}*, ¡Gracias por tu pago! ✨

✅ *RESERVA CONFIRMADA*
📅 *Día:* ${turno.dia}
📆 *Fecha:* ${turno.fecha}
⏰ *Hora:* ${turno.hora}:00 hs
💆‍♂️ *Masaje:* ${turno.massage_type || 'Masaje'}
📍 ${turno.ubicacion || 'Serenity Spa'}

💳 *Pago confirmado*
🧾 *Comprobante:* ${turno.comprobante_pago || 'N/A'}
💵 *Monto:* ${turno.monto_pago || '0.00'} CUP

🔑 *Código de verificación:* ${turno.codigo_verificacion || turno.codigo_cancelacion}

🌸 Te esperamos en Serenity Spa.
⏱️ Cancelá con 4hs de anticipación.

*Equipo Serenity Spa* 🌿`;
        
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
        console.error('❌ Error enviando WhatsApp de confirmación:', error);
        res.status(500).json({ error: 'Error al enviar mensaje de WhatsApp' });
    }
});

































// ============================================================
// MIDDLEWARE BÁSICO
// ============================================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware anti-cache
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

// ============================================================
// INICIALIZAR SEGURIDAD
// ============================================================
(async () => {
    await security.initSecurityFiles();
    console.log('🛡️ Sistema de seguridad blindado iniciado');
})();

// ============================================================
// RUTA DE BLOQUEO
// ============================================================
app.get('/bloqueado', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Acceso Denegado</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    background: #0a0a0a;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Inter', sans-serif;
                    color: #ffffff;
                    padding: 1.5rem;
                    margin: 0;
                }
                .bloqueo-container {
                    text-align: center;
                    max-width: 500px;
                    padding: 3rem 2rem;
                    border: 1px solid rgba(220, 38, 38, 0.3);
                    border-radius: 20px;
                    background: rgba(20, 10, 5, 0.95);
                    box-shadow: 0 0 60px rgba(220, 38, 38, 0.1);
                }
                .bloqueo-icon { font-size: 4rem; color: #dc2626; margin-bottom: 1.5rem; display: block; }
                .bloqueo-titulo { font-size: 1.8rem; font-weight: 700; color: #dc2626; margin-bottom: 1rem; }
                .bloqueo-mensaje { font-size: 1rem; color: rgba(255,255,255,0.7); line-height: 1.6; margin-bottom: 1.5rem; }
                .bloqueo-codigo { font-size: 0.7rem; color: rgba(255,255,255,0.3); letter-spacing: 0.1em; padding: 0.5rem 1rem; border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; display: inline-block; }
                .bloqueo-separador { width: 40px; height: 2px; background: rgba(220,38,38,0.3); margin: 1rem auto; }
                .bloqueo-footer { margin-top: 1.5rem; font-size: 0.6rem; color: rgba(255,255,255,0.15); letter-spacing: 0.2em; }
            </style>
        </head>
        <body>
            <div class="bloqueo-container">
                <span class="bloqueo-icon">⛔</span>
                <h1 class="bloqueo-titulo">Acceso Cancelado</h1>
                <div class="bloqueo-separador"></div>
                <p class="bloqueo-mensaje">Su acceso ha sido cancelado en nuestro sistema por violación de los términos de uso.</p>
                <span class="bloqueo-codigo">🔒 BLOQUEADO · SERENITY SPA</span>
                <div class="bloqueo-footer">Sistema de seguridad activo</div>
            </div>
        </body>
        </html>
    `);
});

// ============================================================
// FUNCIÓN PARA VERIFICAR SI UNA IP ESTÁ BLOQUEADA
// ============================================================
async function isIPBloqueada(ip) {
    try {
        if (ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('169.254.')) {
            return false;
        }
        const bloqueos = await security.getBloqueosActivos();
        return bloqueos.activos.some(b => b.ip === ip && !b.expirado);
    } catch (error) {
        console.error('❌ Error verificando bloqueo:', error);
        return false;
    }
}

// ============================================================
// MIDDLEWARE DE BLOQUEO DE IP
// ============================================================
app.use(async (req, res, next) => {
    const excludedPaths = ['/bloqueado', '/api/seguridad', '/api/verify', '/api/login', '/api/config-emailjs', '/api/usuario', '/api/pago'];
    if (excludedPaths.some(path => req.path.startsWith(path))) {
        return next();
    }

    try {
        const ip = security.getClientIP(req);
        const bloqueado = await isIPBloqueada(ip);
        
        if (bloqueado) {
            console.log(`🛡️ IP BLOQUEADA: ${ip} - Acceso denegado a ${req.path}`);
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return res.status(403).json({ error: 'Acceso cancelado', bloqueado: true });
            }
            return res.redirect('/bloqueado');
        }
        next();
    } catch (error) {
        console.error('❌ Error en middleware de bloqueo:', error);
        next();
    }
});

// ============================================================
// SERVIR ARCHIVOS ESTÁTICOS
// ============================================================
app.use(express.static(BASE_DIR));
app.use(express.static(__dirname));

// ============================================================
// RUTAS HTML EXPLÍCITAS
// ============================================================
function sendFileSafe(fileName) {
    return (req, res) => {
        const filePath = path.join(BASE_DIR, fileName);
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            const fallbackPath = path.join(__dirname, fileName);
            if (fs.existsSync(fallbackPath)) {
                res.sendFile(fallbackPath);
            } else {
                res.status(404).send(`Archivo ${fileName} no encontrado`);
            }
        }
    };
}

app.get('/', sendFileSafe('index.html'));
app.get('/admin', sendFileSafe('admin.html'));
app.get('/admin.html', sendFileSafe('admin.html'));
app.get('/login', sendFileSafe('login.html'));
app.get('/login.html', sendFileSafe('login.html'));
app.get('/registro', sendFileSafe('registro.html'));
app.get('/registro.html', sendFileSafe('registro.html'));
app.get('/asistente', sendFileSafe('asistente.html'));
app.get('/asistente.html', sendFileSafe('asistente.html'));
app.get('/terminos', sendFileSafe('terminos.html'));

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
// CONFIGURACIÓN DE PAGOS - ENDPOINTS PROTEGIDOS
// ============================================================

// Endpoint público - solo información necesaria para el cliente
app.get('/api/pago/config', async (req, res) => {
    try {
        // Intentar obtener desde Supabase primero
        let config = null;
        let source = 'env';
        
        try {
            const supabaseConfig = await db.getConfiguracion('pago');
            if (supabaseConfig && supabaseConfig.transfermovil) {
                config = supabaseConfig;
                source = 'supabase';
            }
        } catch (e) {
            console.warn('⚠️ Error obteniendo config de pago de Supabase:', e);
        }
        
        // Si no hay configuración en Supabase, usar variables de entorno
        if (!config) {
            config = getPagoConfigFromEnv();
            source = 'env';
        }
        
        // Solo devolver datos necesarios, nunca exponer información sensible extra
        const publicConfig = {
            transfermovil: {
                numero: config.transfermovil?.numero || '53571569',
                nombre: config.transfermovil?.nombre || 'Serenity Spa',
                activo: config.transfermovil?.activo !== false
            },
            enzona: {
                numero: config.enzona?.numero || '53571569',
                nombre: config.enzona?.nombre || 'Serenity Spa',
                activo: config.enzona?.activo !== false
            },
            monto: {
                default: config.monto?.default || 25.00,
                moneda: config.monto?.moneda || 'CUP'
            },
            _source: source,
            _protected: true
        };
        
        res.json(publicConfig);
    } catch (error) {
        console.error('❌ Error obteniendo config de pago:', error);
        // Fallback seguro
        const fallback = getPagoConfigFromEnv();
        res.json({
            transfermovil: {
                numero: fallback.transfermovil.numero,
                nombre: fallback.transfermovil.nombre,
                activo: fallback.transfermovil.activo
            },
            enzona: {
                numero: fallback.enzona.numero,
                nombre: fallback.enzona.nombre,
                activo: fallback.enzona.activo
            },
            monto: {
                default: fallback.monto.default,
                moneda: fallback.monto.moneda
            },
            _source: 'env_fallback',
            _protected: true
        });
    }
});

// Endpoint protegido - solo administradores pueden modificar
app.put('/api/pago/config', verifyAuth, async (req, res) => {
    try {
        const { transfermovil, enzona, monto } = req.body;
        
        // Validar datos
        if (transfermovil) {
            if (transfermovil.numero && !/^\d{1,20}$/.test(transfermovil.numero.replace(/\D/g, ''))) {
                return res.status(400).json({ error: 'Número de Transfermóvil inválido' });
            }
            if (transfermovil.nombre && transfermovil.nombre.trim().length < 2) {
                return res.status(400).json({ error: 'Nombre de Transfermóvil inválido' });
            }
        }
        
        if (enzona) {
            if (enzona.numero && !/^\d{1,20}$/.test(enzona.numero.replace(/\D/g, ''))) {
                return res.status(400).json({ error: 'Número de EnZona inválido' });
            }
            if (enzona.nombre && enzona.nombre.trim().length < 2) {
                return res.status(400).json({ error: 'Nombre de EnZona inválido' });
            }
        }
        
        if (monto) {
            if (monto.default && (isNaN(monto.default) || monto.default <= 0)) {
                return res.status(400).json({ error: 'Monto inválido' });
            }
            if (monto.moneda && monto.moneda.trim().length < 1) {
                return res.status(400).json({ error: 'Moneda inválida' });
            }
        }
        
        // Construir configuración
        const envConfig = getPagoConfigFromEnv();
        const newConfig = {
            transfermovil: {
                numero: transfermovil?.numero || envConfig.transfermovil.numero,
                nombre: transfermovil?.nombre || envConfig.transfermovil.nombre,
                activo: transfermovil?.activo !== undefined ? transfermovil.activo : envConfig.transfermovil.activo
            },
            enzona: {
                numero: enzona?.numero || envConfig.enzona.numero,
                nombre: enzona?.nombre || envConfig.enzona.nombre,
                activo: enzona?.activo !== undefined ? enzona.activo : envConfig.enzona.activo
            },
            monto: {
                default: monto?.default || envConfig.monto.default,
                moneda: monto?.moneda || envConfig.monto.moneda
            },
            _meta: {
                updatedAt: new Date().toISOString(),
                updatedBy: req.ip || 'admin',
                version: '2.0'
            }
        };
        
        // Guardar en Supabase
        await db.setConfiguracion('pago', newConfig);
        
        console.log('✅ Configuración de pagos actualizada por admin');
        
        // Devolver solo datos públicos
        const publicResponse = {
            success: true,
            message: 'Configuración de pagos actualizada correctamente',
            config: {
                transfermovil: {
                    numero: newConfig.transfermovil.numero,
                    nombre: newConfig.transfermovil.nombre,
                    activo: newConfig.transfermovil.activo
                },
                enzona: {
                    numero: newConfig.enzona.numero,
                    nombre: newConfig.enzona.nombre,
                    activo: newConfig.enzona.activo
                },
                monto: {
                    default: newConfig.monto.default,
                    moneda: newConfig.monto.moneda
                }
            },
            _protected: true
        };
        
        res.json(publicResponse);
    } catch (error) {
        console.error('❌ Error actualizando config de pago:', error);
        res.status(500).json({ error: 'Error al actualizar configuración de pago' });
    }
});

// Endpoint para sincronizar desde variables de entorno
app.post('/api/pago/config/sync', verifyAuth, async (req, res) => {
    try {
        const envConfig = getPagoConfigFromEnv();
        await db.setConfiguracion('pago', envConfig);
        
        console.log('✅ Configuración de pagos sincronizada desde variables de entorno');
        
        res.json({
            success: true,
            message: 'Configuración sincronizada desde variables de entorno',
            config: {
                transfermovil: {
                    numero: envConfig.transfermovil.numero,
                    nombre: envConfig.transfermovil.nombre,
                    activo: envConfig.transfermovil.activo
                },
                enzona: {
                    numero: envConfig.enzona.numero,
                    nombre: envConfig.enzona.nombre,
                    activo: envConfig.enzona.activo
                },
                monto: {
                    default: envConfig.monto.default,
                    moneda: envConfig.monto.moneda
                }
            },
            _protected: true
        });
    } catch (error) {
        console.error('❌ Error sincronizando config de pago:', error);
        res.status(500).json({ error: 'Error al sincronizar configuración de pago' });
    }
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
        
        const ip = security.getClientIP(req);
        const intentos = security.incrementarIntentosLogin(ip);
        
        if (intentos > 5) {
            await security.bloquearIP(ip, 'Demasiados intentos de login', 'BRUTE_FORCE', null, '/api/login');
            return res.status(429).json({ success: false, mensaje: 'Demasiados intentos. IP bloqueada temporalmente.' });
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
// AUTENTICACIÓN DE USUARIOS
// ============================================================

app.get('/api/usuario/actual', async (req, res) => {
    const h = req.headers.authorization;
    if (!h || !h.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    const token = h.substring(7);
    try {
        const usuario = await db.getUsuarioByToken(token);
        if (usuario) {
            res.json({
                id: usuario.id,
                nombre: usuario.nombre,
                email: usuario.email,
                avatar: usuario.avatar || null
            });
        } else {
            res.status(404).json({ error: 'Usuario no encontrado' });
        }
    } catch (e) {
        console.error('Error obteniendo usuario actual:', e);
        res.status(500).json({ error: 'Error interno' });
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
            return res.json({ 
                valid: true, 
                usuario: { 
                    nombre: usuario.nombre, 
                    email: usuario.email,
                    avatar: usuario.avatar || null
                } 
            });
        }
    } catch (e) {
        console.error('Error verificando token:', e);
    }
    res.json({ valid: false });
});

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

app.post('/api/registro/login-solicitar-codigo', async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'El correo es requerido' });
        }
        
        const usuarioExistente = await db.getUsuarioByEmail(email);
        
        if (!usuarioExistente) {
            return res.status(404).json({ error: 'El correo no está registrado' });
        }
        
        if (usuarioExistente.bloqueado === true) {
            return res.status(403).json({ error: 'Esta cuenta ha sido bloqueada. Contacta al administrador.' });
        }
        
        if (usuarioExistente.verificado !== true) {
            return res.status(400).json({ error: 'Esta cuenta no ha sido verificada. Regístrate nuevamente.' });
        }
        
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const expiracion = Date.now() + 3 * 60 * 1000;
        
        await db.upsertCodigoVerificacion(email, {
            codigo: codigo,
            expiracion: expiracion,
            intentos: 0,
            nombre: usuarioExistente.nombre
        });
        
        console.log(`✅ Código de login generado para ${email}: ${codigo}`);
        res.json({ 
            success: true,
            codigo: codigo,
            nombre: usuarioExistente.nombre
        });
        
    } catch (error) {
        console.error('❌ Error en login-solicitar-codigo:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
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
        const { 
            nombre, telefono, massageType, dia, hora, codigoPais, 
            ubicacion, tipoServicio, fecha, ip, precio,
            // Campos de pago
            metodoPago, metodoPagoNombre, comprobante, monto, estadoPago
        } = req.body;
        
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
        const clientIP = ip || security.getClientIP(req) || 'N/A';
        
        // Obtener usuario autenticado
        let usuarioId = null;
        let usuarioNombre = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const usuario = await db.getUsuarioByToken(token);
                if (usuario) {
                    usuarioId = usuario.id;
                    usuarioNombre = usuario.nombre;
                    console.log(`✅ Turno asociado al usuario: ${usuario.nombre} (${usuario.id})`);
                }
            } catch (e) {
                console.warn('⚠️ No se pudo obtener usuario del token:', e);
            }
        }
        
        // Buscar precio del servicio
        let precioFinal = precio || '';
        if (!precioFinal && massageType) {
            try {
                const { data: servicios } = await supabase
                    .from('servicios')
                    .select('precio')
                    .ilike('nombre', `%${massageType}%`)
                    .limit(1);
                if (servicios && servicios.length > 0 && servicios[0].precio) {
                    precioFinal = servicios[0].precio;
                }
            } catch (e) {}
        }
        
        // Construir el turno con campos de pago
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
            ip: clientIP,
            conteo_bloqueos: 0,
            bloqueado: false,
            estado: 'pendiente',
            confirmado: false,
            precio: precioFinal,
            // Campos de pago
            metodo_pago: metodoPago || 'transfermovil',
            metodo_pago_nombre: metodoPagoNombre || 'Transfermóvil',
            comprobante_pago: comprobante || '',
            monto_pago: monto || 0,
            estado_pago: estadoPago || 'pendiente_verificacion'
        };
        
        // Guardar usuario_id si existe
        if (usuarioId) {
            nuevoTurno.usuario_id = usuarioId;
        } else {
            console.warn('⚠️ Turno creado sin usuario_id (usuario no autenticado)');
        }
        
        try {
            await db.createTurno(nuevoTurno);
            return res.status(201).json({
                mensaje: 'Turno reservado exitosamente',
                turno: nuevoTurno,
                codigoCancelacion: codigoCancelacion,
                usuario_id: usuarioId
            });
        } catch (error) {
            // Si el error es porque la columna no existe, reintentar sin usuario_id
            if (error.code === 'PGRST204' && error.message && error.message.includes('column')) {
                console.log('⚠️ La columna usuario_id no existe, reintentando sin ella...');
                delete nuevoTurno.usuario_id;
                await db.createTurno(nuevoTurno);
                return res.status(201).json({
                    mensaje: 'Turno reservado exitosamente (sin asociación de usuario)',
                    turno: nuevoTurno,
                    codigoCancelacion: codigoCancelacion
                });
            }
            throw error;
        }
        
    } catch (error) {
        console.error('❌ Error creando turno:', error);
        res.status(500).json({ error: 'Error al crear el turno: ' + error.message });
    }
});

// ============================================================
// ELIMINAR TURNO - ADMIN
// ============================================================
app.delete('/turnos/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const turno = await db.getTurnoById(id);
        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        console.log(`🗑️ Admin eliminando turno: ${id} - Cliente: ${turno.nombre} - Servicio: ${turno.massage_type}`);
        await db.deleteTurno(id);
        res.json({ success: true, message: 'Turno eliminado', turnoId: id });
        
    } catch (error) {
        console.error('❌ Error eliminando turno:', error);
        res.status(500).json({ error: 'Error al eliminar turno: ' + error.message });
    }
});

// ============================================================
// ADMIN - ELIMINAR TURNO
// ============================================================
app.delete('/api/admin/turnos/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const turno = await db.getTurnoById(id);
        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        console.log(`🗑️ Admin eliminando turno (api/admin): ${id} - Cliente: ${turno.nombre}`);
        await db.deleteTurno(id);
        
        res.json({ 
            success: true, 
            message: 'Turno eliminado correctamente',
            turnoId: id
        });
        
    } catch (error) {
        console.error('❌ Error eliminando turno (admin):', error);
        res.status(500).json({ error: 'Error al eliminar turno: ' + error.message });
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
        let nombreServicio = turno.massage_type || 'Masaje';
        
        try {
            const { data: servicios } = await supabase
                .from('servicios')
                .select('imagen_whatsapp, imagen_web')
                .ilike('nombre', `%${nombreServicio}%`)
                .limit(1);
            if (servicios && servicios.length > 0) {
                imagenWhatsApp = servicios[0].imagen_whatsapp || servicios[0].imagen_web || '';
            }
        } catch (e) {
            console.warn('⚠️ Error buscando imagen del servicio:', e);
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
        res.status(500).json({ error: 'Error al preparar mensaje: ' + error.message });
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
            return res.status(400).json({ error: 'Debes seleccionar al menos un día de atención' });
        }
        
        if (!data.horarios || !Array.isArray(data.horarios) || data.horarios.length === 0) {
            return res.status(400).json({ error: 'Debes tener al menos un horario disponible' });
        }
        
        if (data.inicio === undefined || data.fin === undefined) {
            return res.status(400).json({ error: 'El rango horario es incompleto' });
        }
        
        if (data.inicio >= data.fin) {
            return res.status(400).json({ error: 'La hora de inicio debe ser menor que la de cierre' });
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
        res.status(500).json({ error: 'Error al guardar horarios: ' + e.message });
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
        const data = req.body;
        
        const paisesData = {
            autorizados: data.autorizados || [],
            bloqueados: data.bloqueados || [],
            modo: data.modo || 'todos',
            ubicacion_salon: data.ubicacionSalon || 'Salón Serenity Spa'
        };
        
        await db.setPaises(paisesData);
        res.json({ success: true, data: paisesData });
    } catch (e) {
        console.error('❌ Error guardando países:', e);
        res.status(500).json({ error: 'Error al guardar países: ' + e.message });
    }
});

app.put('/api/seguridad/ubicacion-salon', verifyAuth, async (req, res) => {
    try {
        const { ubicacion } = req.body;
        
        if (!ubicacion || ubicacion.trim() === '') {
            return res.status(400).json({ error: 'La ubicación es requerida' });
        }
        
        const paises = await db.getPaises();
        await db.setPaises({
            ...paises,
            ubicacion_salon: ubicacion.trim()
        });
        
        res.json({ success: true, ubicacion: ubicacion.trim() });
    } catch (e) {
        console.error('❌ Error guardando ubicación:', e);
        res.status(500).json({ error: 'Error al guardar ubicación: ' + e.message });
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
// BLOQUEO/DESBLOQUEO DE IPs
// ============================================================

app.post('/api/seguridad/bloquear-usuario-ip/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const turno = await db.getTurnoById(id);
        
        if (!turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        const ipUsuario = turno.ip || 'IP desconocida';
        
        const esIPLocal = (ip) => {
            if (ip === 'IP desconocida' || ip === 'N/A' || ip === '::1') return true;
            if (ip.startsWith('127.')) return true;
            if (ip.startsWith('192.168.')) return true;
            if (ip.startsWith('10.')) return true;
            if (ip.startsWith('169.254.')) return true;
            if (ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') || 
                ip.startsWith('172.19.') || ip.startsWith('172.20.') || ip.startsWith('172.21.') || 
                ip.startsWith('172.22.') || ip.startsWith('172.23.') || ip.startsWith('172.24.') || 
                ip.startsWith('172.25.') || ip.startsWith('172.26.') || ip.startsWith('172.27.') || 
                ip.startsWith('172.28.') || ip.startsWith('172.29.') || ip.startsWith('172.30.') || 
                ip.startsWith('172.31.')) return true;
            return false;
        };
        
        if (esIPLocal(ipUsuario)) {
            return res.status(400).json({ 
                error: 'No se puede bloquear esta IP (es local/interna)',
                ip: ipUsuario
            });
        }
        
        const bloqueos = await security.getBloqueosActivos();
        const yaBloqueada = bloqueos.activos.some(b => b.ip === ipUsuario);
        
        if (yaBloqueada) {
            return res.status(400).json({ 
                error: `La IP ${ipUsuario} ya está bloqueada`,
                ip: ipUsuario,
                yaBloqueada: true
            });
        }
        
        const nuevoConteo = (turno.conteo_bloqueos || 0) + 1;
        await db.updateTurno(id, { 
            conteo_bloqueos: nuevoConteo,
            bloqueado: true
        });
        
        await security.bloquearIP(
            ipUsuario, 
            `Bloqueado por admin desde turno de ${turno.nombre} - Conteo: ${nuevoConteo}`, 
            'ADMIN_BLOCK', 
            30 * 24 * 60 * 60 * 1000,
            '/admin/turnos'
        );
        
        console.log(`✅ IP ${ipUsuario} bloqueada exitosamente por admin`);
        
        res.json({ 
            success: true, 
            ip: ipUsuario,
            conteo: nuevoConteo,
            mensaje: `IP ${ipUsuario} bloqueada exitosamente - El usuario no podrá acceder al sitio`
        });
        
    } catch (error) {
        console.error('❌ Error bloqueando IP de usuario:', error);
        res.status(500).json({ error: 'Error al bloquear IP: ' + error.message });
    }
});

app.post('/api/seguridad/desbloquear-ip/:ip', verifyAuth, async (req, res) => {
    try {
        const ip = decodeURIComponent(req.params.ip);
        
        if (!ip || ip === 'IP desconocida' || ip === 'N/A') {
            return res.status(400).json({ error: 'IP inválida' });
        }
        
        const resultado = await security.desbloquearIPAdmin(ip);
        
        if (resultado) {
            console.log(`✅ IP ${ip} desbloqueada exitosamente por admin`);
            res.json({ 
                success: true, 
                ip: ip,
                mensaje: `IP ${ip} desbloqueada exitosamente - El usuario ya puede acceder al sitio`
            });
        } else {
            res.status(404).json({ error: `IP ${ip} no encontrada en bloqueos` });
        }
        
    } catch (error) {
        console.error('❌ Error desbloqueando IP:', error);
        res.status(500).json({ error: 'Error al desbloquear IP: ' + error.message });
    }
});

app.post('/api/seguridad/bloquear-ip', verifyAuth, async (req, res) => {
    try {
        const { ip, motivo } = req.body;
        
        if (!ip || ip === 'IP desconocida' || ip === 'N/A') {
            return res.status(400).json({ error: 'IP inválida' });
        }
        
        const esIPLocal = (ip) => {
            if (ip === '::1') return true;
            if (ip.startsWith('127.')) return true;
            if (ip.startsWith('192.168.')) return true;
            if (ip.startsWith('10.')) return true;
            if (ip.startsWith('169.254.')) return true;
            if (ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') || 
                ip.startsWith('172.19.') || ip.startsWith('172.20.') || ip.startsWith('172.21.') || 
                ip.startsWith('172.22.') || ip.startsWith('172.23.') || ip.startsWith('172.24.') || 
                ip.startsWith('172.25.') || ip.startsWith('172.26.') || ip.startsWith('172.27.') || 
                ip.startsWith('172.28.') || ip.startsWith('172.29.') || ip.startsWith('172.30.') || 
                ip.startsWith('172.31.')) return true;
            return false;
        };
        
        if (esIPLocal(ip)) {
            return res.status(400).json({ error: 'No se puede bloquear una IP local/interna' });
        }
        
        const bloqueos = await security.getBloqueosActivos();
        const yaBloqueada = bloqueos.activos.some(b => b.ip === ip);
        
        if (yaBloqueada) {
            return res.status(400).json({ 
                error: `La IP ${ip} ya está bloqueada`,
                yaBloqueada: true
            });
        }
        
        await security.bloquearIP(
            ip, 
            motivo || 'Bloqueado por administrador', 
            'ADMIN_BLOCK', 
            30 * 24 * 60 * 60 * 1000,
            '/admin/seguridad'
        );
        
        console.log(`✅ IP ${ip} bloqueada manualmente por admin`);
        
        res.json({ 
            success: true, 
            ip: ip,
            mensaje: `IP ${ip} bloqueada exitosamente - El usuario no podrá acceder al sitio`
        });
        
    } catch (error) {
        console.error('❌ Error bloqueando IP:', error);
        res.status(500).json({ error: 'Error al bloquear IP: ' + error.message });
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
// ⭐ PROMOCIONES
// ============================================================
app.get('/api/promociones', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('promociones')
            .select('*')
            .eq('activo', true)
            .order('creado', { ascending: false });
        
        if (error) {
            console.error('Error obteniendo promociones:', error);
            return res.json([]);
        }
        res.json(data || []);
    } catch (e) {
        console.error('Error en /api/promociones:', e);
        res.json([]);
    }
});

// ============================================================
// ⭐ NOVEDADES
// ============================================================
app.get('/api/novedades', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('novedades')
            .select('*')
            .eq('activo', true)
            .order('fecha', { ascending: false });
        
        if (error) {
            console.error('Error obteniendo novedades:', error);
            return res.json([]);
        }
        res.json(data || []);
    } catch (e) {
        console.error('Error en /api/novedades:', e);
        res.json([]);
    }
});

// ============================================================
// ⭐ TURNOS DEL USUARIO (mis turnos)
// ============================================================
app.get('/api/turnos/mis-turnos', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    
    const token = authHeader.substring(7);
    try {
        const usuario = await db.getUsuarioByToken(token);
        if (!usuario) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }
        
        console.log(`🔍 Buscando turnos para usuario: ${usuario.nombre} (${usuario.id})`);
        
        let turnosData = [];
        
        // Buscar por usuario_id
        const { data: turnosPorId, error: errorPorId } = await supabase
            .from('turnos')
            .select('*')
            .eq('usuario_id', usuario.id)
            .order('fecha_creacion', { ascending: false });
        
        if (!errorPorId && turnosPorId && turnosPorId.length > 0) {
            turnosData = turnosPorId;
            console.log(`✅ Turnos encontrados por usuario_id: ${turnosData.length}`);
        } else {
            // Fallback: Buscar por nombre
            console.log(`⚠️ No se encontraron turnos por usuario_id, buscando por nombre...`);
            
            const { data: turnosPorNombre, error: errorPorNombre } = await supabase
                .from('turnos')
                .select('*')
                .eq('nombre', usuario.nombre)
                .order('fecha_creacion', { ascending: false });
            
            if (!errorPorNombre && turnosPorNombre && turnosPorNombre.length > 0) {
                turnosData = turnosPorNombre;
                console.log(`✅ Turnos encontrados por nombre: ${turnosData.length}`);
            } else {
                console.log(`ℹ️ No se encontraron turnos para este usuario`);
                turnosData = [];
            }
        }
        
        // Obtener servicios para imágenes
        const { data: servicios } = await supabase
            .from('servicios')
            .select('*');
        
        const turnos = (turnosData || []).map(t => {
            let imagen = null;
            if (servicios && servicios.length > 0 && t.massage_type) {
                const servicio = servicios.find(s => 
                    s.nombre && s.nombre.toLowerCase().includes(t.massage_type.toLowerCase())
                );
                if (servicio && servicio.imagen_web) {
                    imagen = servicio.imagen_web;
                }
            }
            
            return {
                id: t.id,
                codigo: t.codigo_cancelacion || t.id.slice(0, 8).toUpperCase(),
                codigoCancelacion: t.codigo_cancelacion || t.id.slice(0, 8).toUpperCase(),
                servicio: t.massage_type || 'Masaje',
                precio: t.precio || '',
                localidad: t.ubicacion || 'Salón Serenity Spa',
                fecha: t.fecha || '',
                hora: t.hora !== undefined && t.hora !== null ? `${t.hora}:00` : '',
                estado: t.estado || 'pendiente',
                confirmado: t.confirmado || false,
                fechaReserva: t.fecha_creacion || new Date().toISOString(),
                telefono: t.telefono || '',
                nombre: t.nombre || '',
                dia: t.dia || '',
                tipo_servicio: t.tipo_servicio || 'salon',
                ip: t.ip || 'N/A',
                conteo_bloqueos: t.conteo_bloqueos || 0,
                fecha_confirmacion: t.fecha_confirmacion || null,
                fecha_cancelacion: t.fecha_cancelacion || null,
                motivo_cancelacion: t.motivo_cancelacion || null,
                bloqueado: t.bloqueado || false,
                imagen: imagen,
                ubicacion: t.ubicacion || 'Salón Serenity Spa',
                usuario_id: t.usuario_id || null,
                // Campos de pago
                metodo_pago: t.metodo_pago || '',
                metodo_pago_nombre: t.metodo_pago_nombre || '',
                comprobante_pago: t.comprobante_pago || '',
                monto_pago: t.monto_pago || 0,
                estado_pago: t.estado_pago || ''
            };
        });
        
        console.log(`📋 Total turnos devueltos: ${turnos.length}`);
        res.json(turnos);
        
    } catch (e) {
        console.error('Error en /api/turnos/mis-turnos:', e);
        res.json([]);
    }
});

// ============================================================
// ⭐ CONFIRMAR TURNO
// ============================================================
app.post('/api/turnos/confirmar/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    
    const token = authHeader.substring(7);
    const id = req.params.id;
    
    try {
        const usuario = await db.getUsuarioByToken(token);
        if (!usuario) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }
        
        const { data: turno, error: turnoError } = await supabase
            .from('turnos')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        
        if (turnoError || !turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        if (turno.usuario_id && turno.usuario_id !== usuario.id) {
            return res.status(403).json({ error: 'No tienes permiso para confirmar este turno' });
        }
        if (!turno.usuario_id && turno.nombre !== usuario.nombre) {
            return res.status(403).json({ error: 'No tienes permiso para confirmar este turno' });
        }
        
        if (turno.estado === 'cancelado' || turno.estado === 'cancelado_automatico') {
            return res.status(400).json({ error: 'Este turno ya fue cancelado' });
        }
        
        if (turno.estado === 'confirmado') {
            return res.status(400).json({ error: 'Este turno ya está confirmado' });
        }
        
        const fechaTurno = new Date(turno.fecha);
        const horaTurno = parseInt(turno.hora);
        fechaTurno.setHours(horaTurno, 0, 0, 0);
        const ahora = new Date();
        const diffHoras = (fechaTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        
        if (diffHoras > 1 || diffHoras < 0) {
            return res.status(400).json({ 
                error: 'Solo puedes confirmar el turno 1 hora antes',
                tiempoRestante: diffHoras
            });
        }
        
        const { error: updateError } = await supabase
            .from('turnos')
            .update({
                estado: 'confirmado',
                confirmado: true,
                fecha_confirmacion: new Date().toISOString()
            })
            .eq('id', id);
        
        if (updateError) {
            console.error('Error confirmando turno:', updateError);
            return res.status(500).json({ error: 'Error al confirmar turno' });
        }
        
        res.json({ 
            success: true, 
            mensaje: 'Turno confirmado exitosamente',
            estado: 'confirmado'
        });
    } catch (e) {
        console.error('Error en /api/turnos/confirmar:', e);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ============================================================
// ⭐ CANCELAR TURNO
// ============================================================
app.post('/api/turnos/cancelar/:id', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    
    const token = authHeader.substring(7);
    const id = req.params.id;
    const { motivo } = req.body;
    
    try {
        const usuario = await db.getUsuarioByToken(token);
        if (!usuario) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }
        
        const { data: turno, error: turnoError } = await supabase
            .from('turnos')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        
        if (turnoError || !turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        if (turno.usuario_id && turno.usuario_id !== usuario.id) {
            return res.status(403).json({ error: 'No tienes permiso para cancelar este turno' });
        }
        if (!turno.usuario_id && turno.nombre !== usuario.nombre) {
            return res.status(403).json({ error: 'No tienes permiso para cancelar este turno' });
        }
        
        if (turno.estado === 'cancelado' || turno.estado === 'cancelado_automatico') {
            return res.status(400).json({ error: 'Este turno ya fue cancelado' });
        }
        
        if (turno.estado === 'cancelacion_solicitada') {
            return res.status(400).json({ error: 'Ya solicitaste la cancelación de este turno' });
        }
        
        const fechaTurno = new Date(turno.fecha);
        const horaTurno = parseInt(turno.hora);
        fechaTurno.setHours(horaTurno, 0, 0, 0);
        const ahora = new Date();
        const diffHoras = (fechaTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
        
        if (diffHoras < 2) {
            return res.status(400).json({ 
                error: 'Solo puedes cancelar el turno con 2 horas de anticipación',
                tiempoRestante: diffHoras
            });
        }
        
        const { error: updateError } = await supabase
            .from('turnos')
            .update({
                estado: 'cancelacion_solicitada',
                motivo_cancelacion: motivo || 'Cancelado por el usuario',
                fecha_cancelacion: new Date().toISOString()
            })
            .eq('id', id);
        
        if (updateError) {
            console.error('Error cancelando turno:', updateError);
            return res.status(500).json({ error: 'Error al cancelar turno' });
        }
        
        const mensaje = `❌ *CANCELACIÓN DE TURNO*\n\nHola ${turno.nombre}, tu solicitud de cancelación ha sido registrada.\n\n📅 *Fecha:* ${turno.fecha}\n⏰ *Hora:* ${turno.hora}:00 hs\n💆 *Servicio:* ${turno.massage_type}\n🔑 *Código de cancelación:* ${turno.codigo_cancelacion}\n\nTe confirmaremos la cancelación en breve.`;
        const numero = `${turno.codigo_pais || '53'}${turno.telefono}`;
        const whatsappUrl = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
        
        res.json({ 
            success: true, 
            mensaje: 'Solicitud de cancelación enviada',
            estado: 'cancelacion_solicitada',
            whatsappUrl: whatsappUrl
        });
    } catch (e) {
        console.error('Error en /api/turnos/cancelar:', e);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ============================================================
// ⭐ CONFIRMAR CANCELACIÓN (Admin)
// ============================================================
app.post('/api/turnos/confirmar-cancelacion/:id', verifyAuth, async (req, res) => {
    try {
        const id = req.params.id;
        const { motivo } = req.body;
        
        const { data: turno, error: turnoError } = await supabase
            .from('turnos')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        
        if (turnoError || !turno) {
            return res.status(404).json({ error: 'Turno no encontrado' });
        }
        
        if (turno.estado !== 'cancelacion_solicitada') {
            return res.status(400).json({ error: 'Este turno no tiene una solicitud de cancelación pendiente' });
        }
        
        const { error: updateError } = await supabase
            .from('turnos')
            .update({
                estado: 'cancelado',
                motivo_cancelacion: motivo || 'Confirmado por administrador',
                fecha_cancelacion: new Date().toISOString()
            })
            .eq('id', id);
        
        if (updateError) {
            console.error('Error confirmando cancelación:', updateError);
            return res.status(500).json({ error: 'Error al confirmar cancelación' });
        }
        
        res.json({ success: true, mensaje: 'Cancelación confirmada' });
    } catch (e) {
        console.error('Error en /api/turnos/confirmar-cancelacion:', e);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ============================================================
// ⭐ VERIFICAR TURNOS PARA CANCELACIÓN AUTOMÁTICA
// ============================================================
async function verificarTurnosAutomaticamente() {
    try {
        const ahora = new Date();
        const horasParaConfirmar = 2;
        
        const { data: turnos, error } = await supabase
            .from('turnos')
            .select('*')
            .eq('estado', 'pendiente')
            .eq('confirmado', false)
            .gte('fecha', new Date().toISOString().split('T')[0]);
        
        if (error) {
            console.error('Error obteniendo turnos para verificar:', error);
            return { cancelados: 0 };
        }
        
        let cancelados = 0;
        
        for (const turno of turnos || []) {
            const fechaTurno = new Date(turno.fecha);
            const horaTurno = parseInt(turno.hora);
            fechaTurno.setHours(horaTurno, 0, 0, 0);
            
            const diffHoras = (fechaTurno.getTime() - ahora.getTime()) / (1000 * 60 * 60);
            
            if (diffHoras < horasParaConfirmar && diffHoras > 0) {
                const { error: updateError } = await supabase
                    .from('turnos')
                    .update({
                        estado: 'cancelado_automatico',
                        motivo_cancelacion: `Cancelado automáticamente por no confirmar (${horasParaConfirmar}h antes)`,
                        fecha_cancelacion: new Date().toISOString()
                    })
                    .eq('id', turno.id);
                
                if (!updateError) {
                    cancelados++;
                    console.log(`🔄 Turno ${turno.id} cancelado automáticamente (no confirmado)`);
                }
            }
        }
        
        return { cancelados };
    } catch (e) {
        console.error('Error en verificarTurnosAutomaticamente:', e);
        return { cancelados: 0 };
    }
}

// Ejecutar verificación automática cada 10 minutos
setInterval(async () => {
    try {
        const { cancelados } = await verificarTurnosAutomaticamente();
        if (cancelados > 0) {
            console.log(`🔄 ${cancelados} turnos cancelados automáticamente por no confirmar`);
        }
    } catch (e) {
        console.error('Error en verificación automática:', e);
    }
}, 10 * 60 * 1000);

setTimeout(async () => {
    try {
        const { cancelados } = await verificarTurnosAutomaticamente();
        if (cancelados > 0) {
            console.log(`🔄 ${cancelados} turnos cancelados automáticamente al inicio`);
        }
    } catch (e) {
        console.error('Error en verificación inicial:', e);
    }
}, 5000);

app.post('/api/turnos/verificar-automatico', verifyAuth, async (req, res) => {
    try {
        const { cancelados } = await verificarTurnosAutomaticamente();
        res.json({ 
            success: true, 
            mensaje: `${cancelados} turnos cancelados automáticamente`,
            cancelados: cancelados
        });
    } catch (e) {
        console.error('Error en /api/turnos/verificar-automatico:', e);
        res.status(500).json({ error: 'Error interno' });
    }
});

// ============================================================
// ⭐ RESERVAS (legado - compatibilidad)
// ============================================================
app.get('/api/reservas/mias', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    
    const token = authHeader.substring(7);
    try {
        const usuario = await db.getUsuarioByToken(token);
        if (!usuario) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }
        
        const { data, error } = await supabase
            .from('turnos')
            .select('*')
            .eq('nombre', usuario.nombre)
            .order('fecha_creacion', { ascending: false });
        
        if (error) {
            console.error('Error obteniendo reservas:', error);
            return res.json([]);
        }
        
        const reservas = (data || []).map(t => ({
            id: t.id,
            codigo: t.codigo_cancelacion || t.id.slice(0, 8).toUpperCase(),
            codigoCancelacion: t.codigo_cancelacion || t.id.slice(0, 8).toUpperCase(),
            servicio: t.massage_type || 'Masaje',
            precio: t.precio || '',
            localidad: t.ubicacion || 'Salón Serenity Spa',
            fecha: t.fecha || '',
            hora: t.hora !== undefined && t.hora !== null ? `${t.hora}:00` : '',
            estado: t.estado || 'pendiente',
            confirmado: t.confirmado || false,
            fechaReserva: t.fecha_creacion || new Date().toISOString(),
            telefono: t.telefono || '',
            nombre: t.nombre || '',
            dia: t.dia || '',
            tipo_servicio: t.tipo_servicio || 'salon',
            ip: t.ip || 'N/A',
            conteo_bloqueos: t.conteo_bloqueos || 0,
            bloqueado: t.bloqueado || false
        }));
        
        res.json(reservas);
    } catch (e) {
        console.error('Error en /api/reservas/mias:', e);
        res.json([]);
    }
});

// ============================================================
// RUTAS DE SEGURIDAD PARA ADMIN
// ============================================================
app.get('/api/seguridad/ataques', verifyAuth, security.getAtaques);
app.get('/api/seguridad/bloqueos', verifyAuth, security.getBloqueos);
app.delete('/api/seguridad/bloqueos/:ip', verifyAuth, security.desbloquearIPAdmin);
app.post('/api/seguridad/bloquear', verifyAuth, security.bloquearIPAdmin);
app.put('/api/seguridad/ataques/:id/resolver', verifyAuth, security.resolverAtaque);
app.delete('/api/seguridad/ataques/:id', verifyAuth, security.eliminarAtaque);
app.get('/api/seguridad/estadisticas', verifyAuth, security.getEstadisticasSeguridad);

// ============================================================
// INICIAR SERVIDOR
// ============================================================
console.log(`🚀 Iniciando servidor en puerto ${PORT}...`);
console.log(`📂 Servidor ejecutándose en: ${__dirname}`);
console.log(`📂 Sirviendo archivos desde: ${BASE_DIR}`);

const server = app.listen(PORT, '0.0.0.0', async () => {
    console.log('🌿 ==========================================');
    console.log(`🌿 Serenity Spa iniciado en puerto ${PORT}`);
    console.log('🌿 ==========================================');
    console.log('✅ Servidor listo para recibir peticiones');
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📂 Sirviendo archivos desde: ${BASE_DIR}`);
    
    const checkFiles = ['index.html', 'asistente.html', 'admin.html'];
    for (const file of checkFiles) {
        const filePath = path.join(BASE_DIR, file);
        if (fs.existsSync(filePath)) {
            console.log(`✅ ${file} encontrado en: ${filePath}`);
        } else {
            console.warn(`⚠️ ${file} NO encontrado en: ${filePath}`);
            const rootPath = path.join(__dirname, file);
            if (fs.existsSync(rootPath)) {
                console.log(`   → Encontrado en: ${rootPath}`);
            }
        }
    }
});

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

module.exports = app;