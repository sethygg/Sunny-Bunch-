document.querySelectorAll('[data-clear-school]').forEach(button=>button.addEventListener('click',async()=>{
  button.disabled=true;const status=document.querySelector('[data-school-status]');
  try{const response=await fetch('/api/school-referral',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin'});if(!response.ok)throw new Error();window.location.reload();}
  catch{if(status)status.textContent='Could not remove your selection. Please try again.';button.disabled=false;}
}));
