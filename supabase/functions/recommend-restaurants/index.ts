<<<<<<< HEAD
declare const Deno: any;
=======
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.89.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
<<<<<<< HEAD
=======
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, userLocation } = await req.json();

    // Fetch all verified restaurants
    const { data: restaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id, name, cuisine_type, category, address, is_open, lat, lng, image_url')
      .eq('is_verified', true);

    if (restaurantsError) {
      throw new Error('Failed to fetch restaurants');
    }

    // Fetch user's order history if userId is provided
<<<<<<< HEAD
    let favoriteCategories: string[] = [];
    let favoriteCuisines: string[] = [];
    let hasOrderHistory = false;
=======
    let orderHistory: any[] = [];
    let favoriteCategories: string[] = [];
    let favoriteCuisines: string[] = [];
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f

    if (userId) {
      const { data: orders } = await supabase
        .from('orders')
        .select(`
          restaurant_id,
          restaurants:restaurant_id (name, cuisine_type, category)
        `)
        .eq('customer_id', userId)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })
        .limit(20);

<<<<<<< HEAD
      if (orders && orders.length > 0) {
        hasOrderHistory = true;
        const categories = orders.map((o: any) => o.restaurants?.category).filter(Boolean);
        const cuisines = orders.map((o: any) => o.restaurants?.cuisine_type).filter(Boolean);

        const categoryCount: Record<string, number> = {};
        const cuisineCount: Record<string, number> = {};

=======
      if (orders) {
        orderHistory = orders;
        // Extract favorite categories and cuisines
        const categories = orders.map((o: any) => o.restaurants?.category).filter(Boolean);
        const cuisines = orders.map((o: any) => o.restaurants?.cuisine_type).filter(Boolean);
        
        // Count occurrences
        const categoryCount: Record<string, number> = {};
        const cuisineCount: Record<string, number> = {};
        
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
        categories.forEach((c: string) => {
          categoryCount[c] = (categoryCount[c] || 0) + 1;
        });
        cuisines.forEach((c: string) => {
          cuisineCount[c] = (cuisineCount[c] || 0) + 1;
        });
<<<<<<< HEAD

=======
        
        // Get top 3
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
        favoriteCategories = Object.entries(categoryCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([k]) => k);
<<<<<<< HEAD

=======
        
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
        favoriteCuisines = Object.entries(cuisineCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([k]) => k);
      }
    }

    // Build context for AI
<<<<<<< HEAD
    const restaurantList = (restaurants as any[])?.map((r: { id: string; name: string; cuisine_type: string | null; category: string; is_open: boolean; lat: number | null; lng: number | null }) => ({
=======
    const restaurantList = restaurants?.map(r => ({
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
      id: r.id,
      name: r.name,
      cuisine: r.cuisine_type || 'Various',
      category: r.category || 'food',
      isOpen: r.is_open,
      hasLocation: !!(r.lat && r.lng),
    })) || [];

    const systemPrompt = `You are a restaurant recommendation assistant. Based on user preferences and order history, recommend the top 5 restaurants from the available list.

Available restaurants:
${JSON.stringify(restaurantList, null, 2)}

User preferences:
- Favorite categories: ${favoriteCategories.length > 0 ? favoriteCategories.join(', ') : 'None yet'}
- Favorite cuisines: ${favoriteCuisines.length > 0 ? favoriteCuisines.join(', ') : 'None yet'}
<<<<<<< HEAD
- Has order history: ${hasOrderHistory ? 'Yes' : 'No'}
=======
- Has order history: ${orderHistory.length > 0 ? 'Yes' : 'No'}
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
- Location provided: ${userLocation ? 'Yes' : 'No'}

Rules:
1. Prioritize OPEN restaurants
2. Match user's favorite categories and cuisines if available
3. For new users, recommend popular/diverse options
4. Return ONLY a JSON array of restaurant IDs in order of recommendation
5. Include a brief reason for each recommendation

Return format (strict JSON):
{
  "recommendations": [
    { "id": "uuid", "reason": "Brief reason" }
  ]
}`;

<<<<<<< HEAD
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    // Fallback recommendations logic
    const getFallbackRecommendations = () => {
      return restaurantList
        .filter(r => r.isOpen)
        .slice(0, 5)
        .map(r => ({ id: r.id, reason: 'Popular choice nearby' }));
    };

    let recommendations: { id: string; reason: string }[] = [];

    if (!LOVABLE_API_KEY) {
      console.log('LOVABLE_API_KEY not found, using fallback recommendations');
      recommendations = getFallbackRecommendations();
    } else {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'Please recommend restaurants for me based on my preferences.' }
          ],
        }),
      });

      if (!response.ok) {
        console.error('AI gateway error, using fallback');
        recommendations = getFallbackRecommendations();
      } else {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            recommendations = parsed.recommendations || [];
          }
        } catch (e) {
          console.error('Failed to parse AI response:', e);
          recommendations = getFallbackRecommendations();
        }
      }
=======
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Please recommend restaurants for me based on my preferences.' }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error('AI gateway error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse AI response
    let recommendations: { id: string; reason: string }[] = [];
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        recommendations = parsed.recommendations || [];
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      // Fallback: return first 5 open restaurants
      recommendations = restaurantList
        .filter(r => r.isOpen)
        .slice(0, 5)
        .map(r => ({ id: r.id, reason: 'Popular choice' }));
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
    }

    // Enrich recommendations with full restaurant data
    const enrichedRecommendations = recommendations.map(rec => {
<<<<<<< HEAD
      const restaurant = restaurants?.find((r: { id: string }) => r.id === rec.id);
=======
      const restaurant = restaurants?.find(r => r.id === rec.id);
>>>>>>> f90644cdeefd6be224926a581cb731aa56204a3f
      return restaurant ? {
        ...restaurant,
        recommendationReason: rec.reason,
      } : null;
    }).filter(Boolean);

    return new Response(JSON.stringify({ recommendations: enrichedRecommendations }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error in recommend-restaurants:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
