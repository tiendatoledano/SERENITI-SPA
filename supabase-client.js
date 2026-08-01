// ============================================================
// supabase-client.js - SOLO SE EJECUTA EN EL SERVIDOR
// NUNCA se expone al frontend
// ============================================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ ERROR CRÍTICO: Variables de entorno de Supabase faltantes');
    console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅ Definida' : '❌ Faltante');
    console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅ Definida' : '❌ Faltante');
    process.exit(1);
}

console.log('🔐 Conectando a Supabase con Service Role Key (solo servidor)...');

// ⚠️ IMPORTANTE: Este cliente tiene permisos COMPLETOS
// SOLO debe usarse en el servidor, NUNCA se expone al frontend
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    },
    db: {
        schema: 'public'
    }
});

// Verificar conexión
async function verificarConexion() {
    try {
        const { data, error } = await supabaseAdmin
            .from('servicios')
            .select('count', { count: 'exact', head: true });
        
        if (error) {
            console.error('❌ Error conectando a Supabase:', error.message);
            return false;
        }
        
        console.log('✅ Conexión a Supabase establecida correctamente');
        return true;
    } catch (e) {
        console.error('❌ Error verificando conexión:', e);
        return false;
    }
}

// Ejecutar verificación
verificarConexion();

module.exports = { supabaseAdmin };