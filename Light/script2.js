const bulb =document.getElementById("bulb");
const btn = document.getElementById("btn");
btn.addEventListener("click", function(){
    bulb.classList.toggle("on");
    if(bulb.classList.contains("on")){
        btn.textContent = "Turn OFF";
    }else{
        btn.textContent="Turn on";
    }
});