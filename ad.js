(function() {
    const DB_URL = "https://perclicks4-default-rtdb.firebaseio.com";
    const PAYOUT_PER_CLICK = 0.15;
    
    const adContainer = document.getElementById('perclicks-ad-unit');
    if (!adContainer) return;

    const siteId = adContainer.getAttribute('data-site-id');
    const ownerUid = adContainer.getAttribute('data-owner-uid');

    // --- ANTI-BOT LAYER 1: Visibility Check ---
    // Ad must be on screen for at least 2 seconds before a click is valid
    let adVisibleTime = 0;
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) adVisibleTime = Date.now();
    }, { threshold: [0.5] });
    observer.observe(adContainer);

    // --- ANTI-BOT LAYER 2: Simple Browser Fingerprint ---
    const getFingerprint = () => {
        return btoa(navigator.userAgent + navigator.language + screen.width).slice(0, 16);
    };

    // Render Ad
    adContainer.innerHTML = `
        <div style="width:100%; border:1px solid #ddd; border-radius:8px; overflow:hidden; cursor:pointer;" id="pc-box">
            <a href="https://advertiser.com" target="_blank" id="pc-link" style="text-decoration:none;">
                <img src="https://via.placeholder.com/728x90/4F46E5/FFFFFF?text=Verified+Ad+Partner" style="width:100%; height: 100%; display:block;">
            </a>
        </div>
    `;

    document.getElementById('pc-link').addEventListener('click', async function(e) {
        const now = Date.now();
        const fingerprint = getFingerprint();

        // --- ANTI-BOT LAYER 3: Timing Defense ---
        if (adVisibleTime === 0 || (now - adVisibleTime) < 2000) {
            console.warn("PerClicks: Invalid Interaction (Too Fast)");
            return; 
        }

        // --- ANTI-BOT LAYER 4: Session Lock ---
        if (sessionStorage.getItem('pc_block_' + siteId)) return;
        sessionStorage.setItem('pc_block_' + siteId, 'true');

        try {
            // Get IP/ID specific cooldown from Firebase to prevent repeat clicks
            // We use a "logs" node in Firebase to track unique fingerprints
            const logId = fingerprint + "_" + new Date().toISOString().split('T')[0];
            const checkLog = await fetch(`${DB_URL}/click_logs/${siteId}/${logId}.json`);
            const logExists = await checkLog.json();

            if (logExists) {
                console.warn("PerClicks: Daily limit reached for this user.");
                return;
            }

            const siteRes = await fetch(`${DB_URL}/all_websites/${siteId}.json`);
            const siteData = await siteRes.json();

            if (!siteData || siteData.status !== "active") return;

            const userRes = await fetch(`${DB_URL}/users/${ownerUid}.json`);
            const userData = await userRes.json();

            // Prepare Updates
            const updates = {};
            const reward = PAYOUT_PER_CLICK;

            // Record the log to block this user for 24 hours
            updates[`/click_logs/${siteId}/${logId}`] = { timestamp: now, uid: ownerUid };
            
            // Increment Money
            updates[`/all_websites/${siteId}/clicks`] = (siteData.clicks || 0) + 1;
            updates[`/all_websites/${siteId}/earned`] = (siteData.earned || 0) + reward;
            updates[`/users/${ownerUid}/balance`] = (userData.balance || 0) + reward;
            updates[`/users/${ownerUid}/today_earnings`] = (userData.today_earnings || 0) + reward;
            updates[`/users/${ownerUid}/lifetime_earnings`] = (userData.lifetime_earnings || 0) + reward;
            updates[`/users/${ownerUid}/websites/${siteId}/clicks`] = (siteData.clicks || 0) + 1;
            updates[`/users/${ownerUid}/websites/${siteId}/earned`] = (siteData.earned || 0) + reward;

            await fetch(`${DB_URL}/.json`, {
                method: 'PATCH',
                body: JSON.stringify(updates)
            });

        } catch (err) {
            console.error("PC-Security-Err");
        }
    });
})();
