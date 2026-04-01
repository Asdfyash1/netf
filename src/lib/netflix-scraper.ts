import { ParsedCookie } from './cookie-parser';

// Helper for extracting regex groups
export function extractGroup(html: string, regex: RegExp, fallback: string = 'Unknown'): string {
    const match = html.match(regex);
    if (match && match[1]) {
        // Decode hex characters like \x40 -> @
        let decoded = match[1].replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => 
            String.fromCharCode(parseInt(hex, 16))
        );
        // Decode unicode characters like \u0040 -> @
        decoded = decoded.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => 
            String.fromCharCode(parseInt(hex, 16))
        );
        return decoded;
    }
    return fallback;
}

// Global robust scraper for Netflix Account Pages
export async function scrapeAccountDetails(cookie: ParsedCookie, fetchOptions: any) {
    try {
        // 1. Fetch main account page
        const accRes = await fetch('https://www.netflix.com/YourAccount', fetchOptions);
        const accHtml = await accRes.text();
        
        cookie.email = extractGroup(accHtml, /"(?:userEmail|emailAddress)":"([^"]+)"/, cookie.email || 'Unknown');
        cookie.firstName = extractGroup(accHtml, /"firstName":"([^"]+)"/, cookie.firstName || 'Unknown');
        cookie.phoneNumber = extractGroup(accHtml, /"phoneNumber":"([^"]+)"/, 'Unknown');
        cookie.country = extractGroup(accHtml, /"(?:currentCountry|uiCountry)":"([^"]+)"/, cookie.country || 'Unknown');
        
        const isMember = accHtml.includes('CURRENT_MEMBER') || accHtml.includes('membershipStatus":"CURRENT_MEMBER');
        cookie.membershipStatus = isMember ? 'CURRENT_MEMBER' : 'Expired/Unknown';

        // 2. Fetch membership page (contains plan, price, next billing)
        const memRes = await fetch('https://www.netflix.com/account/membership', fetchOptions);
        const memHtml = await memRes.text();
        
        cookie.plan = extractGroup(memHtml, /"planName":"([^"]+)"/, 'Unknown');
        if (cookie.plan === 'Unknown') {
            cookie.plan = extractGroup(memHtml, /"currentPlanName":"([^"]+)"/, 'Unknown');
        }
        
        // Deep fallback for plan: search for localized plan names in text
        if (cookie.plan === 'Unknown') {
            if (memHtml.includes('Premium') || memHtml.includes('高級')) cookie.plan = 'Premium';
            else if (memHtml.includes('Standard') || memHtml.includes('標準')) cookie.plan = 'Standard';
            else if (memHtml.includes('Basic') || memHtml.includes('基本')) cookie.plan = 'Basic';
        }

        cookie.maxStreams = extractGroup(memHtml, /"maxStreams":(\d+)/, 'Unknown');
        cookie.videoQuality = extractGroup(memHtml, /"(?:videoResolution|videoQuality)":"([^"]+)"/, 'Unknown');
        cookie.price = extractGroup(memHtml, /"(?:priceString|localizedPrice)":"([^"]+)"/, 'Unknown');
        cookie.nextBilling = extractGroup(memHtml, /"(?:nextBillingDate|formattedNextBillingDate)":"([^"]+)"/, 'Unknown');
        cookie.memberSince = extractGroup(memHtml, /"(?:memberSince|formattedMemberSince)":"([^"]+)"/, 'Unknown');

        // 3. Profiles
        const profRes = await fetch('https://www.netflix.com/account/profiles', fetchOptions);
        const profHtml = await profRes.text();
        const guidMatches = profHtml.match(/"guid":"/g) || accHtml.match(/"guid":"/g);
        cookie.profilesCount = guidMatches ? guidMatches.length : 1;

        // 4. Payment Info
        const payRes = await fetch('https://www.netflix.com/simplemember/managepaymentinfo', fetchOptions);
        const payHtml = await payRes.text();
        cookie.paymentMethod = extractGroup(payHtml, /"paymentMethodName":"([^"]+)"/, 'Unknown');
        if (cookie.paymentMethod === 'Unknown') {
            cookie.paymentMethod = extractGroup(payHtml, /"brand":"([^"]+)"/, 'Unknown');
        }

    } catch (e) {
        console.error("Scraping error:", e);
    }
}
