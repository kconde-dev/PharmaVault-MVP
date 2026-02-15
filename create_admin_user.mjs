import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read environment variables
function readEnvFile(path) {
    if (!fs.existsSync(path)) return {};
    const content = fs.readFileSync(path, 'utf8');
    return Object.fromEntries(
        content
            .split(/\n+/)
            .map((l) => l.trim())
            .filter((l) => l && !l.startsWith('#'))
            .map((l) => {
                const idx = l.indexOf('=');
                return [l.slice(0, idx), l.slice(idx + 1)];
            })
    );
}

const env = readEnvFile('.env.local');
const SUPABASE_URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

async function createAdminUser() {
    console.log('Creating admin user...');

    const username = 'admin';
    const email = `${username}@pharmavault.com`;
    const password = '123456'; // 6-digit PIN

    try {
        // Sign up the user
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username,
                    display_name: username,
                },
            },
        });

        if (signUpError) {
            if (signUpError.message.includes('already registered')) {
                console.log('✅ User already exists:', email);
                console.log('You can log in with:');
                console.log('  Username: admin');
                console.log('  Password: 123456');
                return;
            }
            throw signUpError;
        }

        if (!signUpData.user) {
            throw new Error('Failed to create user');
        }

        console.log('✅ User created:', signUpData.user.id);

        // Add to user_roles table
        const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
                user_id: signUpData.user.id,
                role: 'administrator',
                username: username,
                created_at: new Date().toISOString(),
            });

        if (roleError) {
            console.error('⚠️  Warning: Could not add role:', roleError.message);
            console.log('You may need to add the role manually in the Supabase dashboard');
        } else {
            console.log('✅ Role assigned: administrator');
        }

        console.log('\n🎉 Admin user created successfully!');
        console.log('Login credentials:');
        console.log('  Username: admin');
        console.log('  Password: 123456');
        console.log('\nYou can now log in to the application!');

    } catch (error) {
        console.error('❌ Error:', error.message || error);
        process.exit(1);
    }
}

createAdminUser();
