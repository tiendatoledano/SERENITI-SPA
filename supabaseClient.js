const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ✅ Usar el nombre correcto de la variable en Render
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // ← Cambiar aquí

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERROR: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
module.exports = supabase;