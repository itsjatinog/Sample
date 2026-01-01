(function(){
    console.log("Hosted script loaded");

    function run() {
        const el = document.getElementById("message");
        if (el) {
            el.textContent = "Hello from hosted JS!";
            console.log("Updated message");
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", run);
    } else {
        run();
    }
})();
