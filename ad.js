(function() {
    const DB_URL = "https://perclicks4-default-rtdb.firebaseio.com";
    const PAYOUT_PER_CLICK = 0.15;
    
    const adContainer = document.getElementById('perclicks-ad-unit');
    if (!adContainer) return;

    const siteId = adContainer.getAttribute('data-site-id');
    const ownerUid = adContainer.getAttribute('data-owner-uid');

    // Anti-Bot: Visibility Check
    let adVisibleTime = 0;
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) adVisibleTime = Date.now();
    }, { threshold: [0.5] });
    observer.observe(adContainer);

    // Injection of the ShrinkMe Banner
    adContainer.innerHTML = `
        <div style="width:100%; max-width:728px; margin:10px auto; overflow:hidden; font-family:sans-serif;" id="pc-box">
            <a href="https://shrinkme.io/ref/101479652244104918244" target="_blank" id="pc-main-link" style="display:block; text-decoration:none;">
                <img src="https://shrinkme.io/banners/ref/728x90GIF.gif" 
                     alt="Make money" 
                     style="width:100%; height:auto; display:block; border-radius:4px; border:1px solid #eee;">
                <div style="font-size:9px; color:#ccc; text-align:right; margin-top:2px;">Ads by PerClicks</div>
            </a>
        </div>
    `;

    document.getElementById('pc-main-link').addEventListener('click', async function(e) {
        const now = Date.now();
        
        // Anti-Bot: Must be visible for 2 seconds
        if (adVisibleTime === 0 || (now - adVisibleTime) < 2000) return;

        // Session Lock
        if (sessionStorage.getItem('pc_block_' + siteId)) return;

        try {
            // 1. Check Site Status
            const siteRes = await fetch(`${DB_URL}/all_websites/${siteId}.json`);
            const siteData = await siteRes.json();

            if (!siteData || siteData.status !== "active") {
                console.warn("PerClicks: Site Pending Approval");
                return;
            }

            // Lock session after successful status check
            sessionStorage.setItem('pc_block_' + siteId, 'true');

            // 2. Fetch User Data
            const userRes = await fetch(`${DB_URL}/users/${ownerUid}.json`);
            const userData = await userRes.json();

            // 3. Prepare Multi-Path Updates
            const reward = PAYOUT_PER_CLICK;
            const updates = {};
            
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
            console.error("Tracking Failed");
        }
    });
})();
