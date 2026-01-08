
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mchzexkrbgwwohydkxih.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jaHpleGtyYmd3d29oeWRreGloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4OTMyODIsImV4cCI6MjA4MzQ2OTI4Mn0.lKeefdFF9alIy07_5oOYzJNhvWBvIOdKSaA3k53cLeA'

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key in environment variables')
    process.exit(1)
}

console.log('Testing connection to:', supabaseUrl)

const supabase = createClient(supabaseUrl, supabaseKey)

async function testConnection() {
    try {
        const { data, error } = await supabase.from('_test_connection').select('*').limit(1)

        // We expect an error if the table doesn't exist, but it should still confirm connection
        if (error) {
            if (error.code === 'PGRST116' || error.message.includes('relation "_test_connection" does not exist')) {
                console.log('Successfully connected to Supabase (Table not found as expected, but connection OK)')
            } else {
                console.error('Connection error:', error.message)
            }
        } else {
            console.log('Successfully connected to Supabase!')
        }
    } catch (err) {
        console.error('Unexpected error:', err)
    }
}

testConnection()
