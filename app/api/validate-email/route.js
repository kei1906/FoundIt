import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

export async function POST(req) {
    try {
        const { email } = await req.json();
        
        if (!email) {
            return Response.json({ valid: false, message: 'Email is required' }, { status: 400 });
        }

        // 1. Strict Syntax Check
        // Checks for standard valid email format without weird characters
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return Response.json({ valid: false, message: 'Invalid Email.' });
        }

        // 2. Domain MX Record Validation
        // Checks if the domain actually has mail servers configured
        const domain = email.split('@')[1];
        
        try {
            const mxRecords = await resolveMx(domain);
            if (!mxRecords || mxRecords.length === 0) {
                return Response.json({ valid: false, message: 'Invalid Email.' });
            }
        } catch (dnsError) {
            // DNS lookup failed (domain doesn't exist or has no MX records)
            return Response.json({ valid: false, message: 'Invalid Email.' });
        }

        // Passed all checks
        return Response.json({ valid: true });

    } catch (error) {
        console.error('Email validation error:', error);
        return Response.json({ valid: false, message: 'Error validating email' }, { status: 500 });
    }
}
