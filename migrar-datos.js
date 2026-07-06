// migrar-datos.js - Migrar datos de JSON a Supabase
const fs = require('fs');
const path = require('path');
const supabase = require('./supabaseClient');

async function migrarDatos() {
    console.log('🔄 Iniciando migración de datos a Supabase...');
    
    const archivos = [
        { nombre: 'turnos.json', tabla: 'turnos', mapeo: (d) => ({ ...d, massage_type: d.massageType, codigo_pais: d.codigoPais, tipo_servicio: d.tipoServicio, confirmado_whatsapp: d.confirmadoWhatsApp, fecha_creacion: d.fechaCreacion, codigo_cancelacion: d.codigoCancelacion, conteo_bloqueos: d.conteoBloqueos }) },
        { nombre: 'testimonios.json', tabla: 'testimonios', mapeo: (d) => d },
        { nombre: 'servicios.json', tabla: 'servicios', mapeo: (d) => ({ ...d, imagen_web: d.imagenWeb, imagen_whatsapp: d.imagenWhatsApp, video_url: d.videoUrl }) },
        { nombre: 'registro-usuarios.json', tabla: 'usuarios', mapeo: (d) => ({ ...d, fecha_registro: d.fechaRegistro, motivo_bloqueo: d.motivoBloqueo }) },
    ];
    
    for (const { nombre, tabla, mapeo } of archivos) {
        const filePath = path.join(__dirname, nombre);
        if (!fs.existsSync(filePath)) {
            console.log(`⚠️ ${nombre} no existe, saltando...`);
            continue;
        }
        
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (!data || data.length === 0) {
                console.log(`📭 ${nombre} está vacío, saltando...`);
                continue;
            }
            
            const datosMapeados = data.map(mapeo);
            
            // Eliminar datos existentes en la tabla
            await supabase.from(tabla).delete().neq('id', '');
            
            // Insertar en lotes de 100
            const batchSize = 100;
            for (let i = 0; i < datosMapeados.length; i += batchSize) {
                const batch = datosMapeados.slice(i, i + batchSize);
                const { error } = await supabase.from(tabla).insert(batch);
                if (error) {
                    console.error(`❌ Error insertando en ${tabla}:`, error);
                } else {
                    console.log(`✅ ${batch.length} registros migrados a ${tabla}`);
                }
            }
        } catch (e) {
            console.error(`❌ Error procesando ${nombre}:`, e);
        }
    }
    
    // Migrar configuración
    const configs = [
        { archivo: 'config.json', clave: 'general' },
        { archivo: 'registro-config.json', clave: 'registro' },
        { archivo: 'horarios.json', clave: 'horarios' },
        { archivo: 'modalidades.json', clave: 'modalidades' },
        { archivo: 'paises.json', clave: 'paises' },
        { archivo: 'palabras-baneadas.json', clave: 'palabras_baneadas' },
    ];
    
    for (const { archivo, clave } of configs) {
        const filePath = path.join(__dirname, archivo);
        if (!fs.existsSync(filePath)) continue;
        
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const { error } = await supabase
                .from('configuracion')
                .upsert({ clave, valor: data }, { onConflict: 'clave' });
            
            if (error) {
                console.error(`❌ Error guardando ${archivo}:`, error);
            } else {
                console.log(`✅ ${archivo} migrado a configuracion.${clave}`);
            }
        } catch (e) {
            console.error(`❌ Error procesando ${archivo}:`, e);
        }
    }
    
    console.log('✅ Migración completada');
}

migrarDatos();