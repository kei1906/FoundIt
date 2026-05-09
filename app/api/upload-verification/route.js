import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * POST /api/upload-verification
 * Accepts multipart form data with a 'file' field.
 * Uploads the verification document to supabase storage and
 * updates the user's profile with the document URL.
 */
export async function POST(request) {
    try {
        // Authenticate user
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.replace('Bearer ', '');
        const userClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        const { data: { user }, error: userError } = await userClient.auth.getUser();
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse multipart form data
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, PDF' },
                { status: 400 }
            );
        }

        // Validate file size (5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 5MB.' },
                { status: 400 }
            );
        }

        // Generate file path: verification-docs/{userId}/{timestamp}.{ext}
        const ext = file.name.split('.').pop() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
        const filePath = `${user.id}/${Date.now()}.${ext}`;

        // Upload using admin client (bypasses RLS for service role)
        const adminClient = getSupabaseAdmin();
        const buffer = Buffer.from(await file.arrayBuffer());

        const { data: uploadData, error: uploadError } = await adminClient.storage
            .from('verification-docs')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error('Verification doc upload error:', uploadError);
            return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
        }

        // Get the URL (signed URL since bucket is private)
        // We store the path; admin will generate signed URLs on demand
        const docPath = uploadData.path;

        // Update profile with doc URL and reset verification to pending
        const { error: updateError } = await adminClient
            .from('profiles')
            .update({
                verification_doc_url: docPath,
                verification_status: 'pending',
                verification_reviewed_by: null,
                verification_reviewed_at: null,
                verification_rejection_reason: null,
            })
            .eq('id', user.id);

        if (updateError) {
            console.error('Profile update error:', updateError);
            return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
        }

        return NextResponse.json({
            message: 'Verification document uploaded successfully',
            path: docPath,
        }, { status: 200 });

    } catch (err) {
        console.error('Upload verification error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
