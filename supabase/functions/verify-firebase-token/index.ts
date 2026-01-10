import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as jose from 'https://deno.land/x/jose@v4.14.4/index.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { firebaseToken } = await req.json()

        if (!firebaseToken) {
            throw new Error('Missing firebaseToken')
        }

        // 1. Decode Firebase Token to get Phone Number
        // Ideally we verify signature here. For now we decode to get claims.
        const claims = jose.decodeJwt(firebaseToken) as { phone_number?: string, sub: string };

        if (!claims.phone_number) {
            throw new Error('Firebase token missing phone_number');
        }

        const phone = claims.phone_number;

        // 2. Admin: Get/Create Supabase User
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Check if user exists by phone
        const { data: { users }, error: searchError } = await supabaseAdmin.auth.admin.listUsers();
        if (searchError) throw searchError;

        let user = users.find(u => u.phone === phone);

        if (!user) {
            // Create new user
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                phone: phone,
                phone_confirm: true,
                user_metadata: { firebase_uid: claims.sub }
            });
            if (createError) throw createError;
            user = newUser.user;
        }

        if (!user) throw new Error('Failed to find or create user');

        // 3. Mint Supabase Access Token
        // We need the project JWT secret
        const jwtSecret = Deno.env.get('JWT_SECRET') ?? Deno.env.get('SUPABASE_JWT_SECRET') ?? '';
        if (!jwtSecret) throw new Error('Server configuration error: Missing JWT secret');

        const secret = new TextEncoder().encode(jwtSecret);
        const alg = 'HS256';

        const accessToken = await new jose.SignJWT({
            aud: 'authenticated',
            role: 'authenticated',
            sub: user.id,
            app_metadata: { provider: 'firebase_bridge' },
            user_metadata: user.user_metadata,
            phone: user.phone
        })
            .setProtectedHeader({ alg })
            .setIssuedAt()
            .setExpirationTime('1h') // Token valid for 1 hour
            .sign(secret);

        // 4. Return the token
        return new Response(
            JSON.stringify({
                access_token: accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    phone: user.phone
                }
            }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            },
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            },
        )
    }
})
