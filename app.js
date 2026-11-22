const pages = ["overview","projects","create","settings"];
const projects = [
  {name:"The Last Kingdom",language:"English",duration:"5–10 minutes",status:"Ready",format:"Vertical · 1080 × 1920"},
  {name:"Shadows of the Past",language:"Burmese",duration:"1–3 minutes",status:"Draft",format:"Script not generated"}
];
let selectedSource="upload", selectedLanguage="Burmese", selectedDuration="1–3 minutes", selectedFile=null;
const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function go(page){pages.forEach(p=>$("#page-"+p).classList.toggle("active",p===page));$$(".nav-item[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===page));$("#crumb").textContent=page[0].toUpperCase()+page.slice(1);$("#sidebar").classList.remove("open");if(page==="projects")renderProjects()}
$$("[data-page]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.page)));
$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));
$("#mobileMenu").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$$(".source-tab").forEach(b=>b.addEventListener("click",()=>{selectedSource=b.dataset.source;$$(".source-tab").forEach(x=>x.classList.toggle("selected",x===b));$("#uploadZone").classList.toggle("hidden",selectedSource!=="upload");$("#linkField").classList.toggle("hidden",selectedSource!=="link")}));
$("#browseFile").addEventListener("click",()=>$("#movieFile").click());
$("#movieFile").addEventListener("change",e=>{selectedFile=e.target.files[0]||null;$("#fileSelected").textContent=selectedFile?`✓ ${selectedFile.name} · ${(selectedFile.size/1024/1024).toFixed(1)} MB`:""});
const zone=$("#uploadZone");
zone.addEventListener("dragover",e=>{e.preventDefault();zone.style.borderColor="#d7b878"});
zone.addEventListener("dragleave",()=>zone.style.borderColor="");
zone.addEventListener("drop",e=>{e.preventDefault();zone.style.borderColor="";const f=e.dataTransfer.files[0];if(f&&f.type.startsWith("video/")){selectedFile=f;$("#fileSelected").textContent=`✓ ${f.name} · ${(f.size/1024/1024).toFixed(1)} MB`}else toast("Please drop a video file.")});
$$(".choice").forEach(b=>b.addEventListener("click",()=>{const group=b.dataset.choice;$$(`.choice[data-choice="${group}"]`).forEach(x=>x.classList.toggle("selected",x===b));if(group==="language")selectedLanguage=b.dataset.value;if(group==="duration")selectedDuration=b.dataset.value}));
$("#createProject").addEventListener("click",()=>{const name=$("#projectName").value.trim();const url=$("#movieUrl").value.trim();if(!name){toast("Enter a project name first.");$("#projectName").focus();return}if(selectedSource==="upload"&&!selectedFile){toast("Choose a movie file first.");return}if(selectedSource==="link"&&!url){toast("Paste a movie link first.");$("#movieUrl").focus();return}projects.unshift({name,language:selectedLanguage,duration:selectedDuration,status:"Draft",format:selectedSource==="upload"?selectedFile.name:url});$("#projectName").value="";$("#movieUrl").value="";$("#movieFile").value="";selectedFile=null;$("#fileSelected").textContent="";$("#totalProjects").textContent=String(projects.length).padStart(2,"0");toast("Project saved in this prototype. AI processing is not connected yet.");go("projects")});
function card(p,i){const cls=i%2?"poster-two":"poster-one";return `<article class="project-card"><div class="poster ${cls}"><span>PROJECT ${String(i+1).padStart(3,"0")}</span><strong>${escapeHtml(p.name.toUpperCase())}</strong><small>STORY RECAP</small></div><div class="project-info"><div><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.language)} · ${escapeHtml(p.duration)}</span></div><span class="pill ${p.status==="Ready"?"ready":"draft"}">${p.status}</span></div><div class="project-meta"><span>${escapeHtml(p.format)}</span><button class="more-button" aria-label="More">•••</button></div></article>`}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function renderProjects(){const markup=projects.map(card).join("");$("#allProjects").innerHTML=markup;$("#recentProjects").innerHTML=projects.slice(0,2).map(card).join("")+`<button class="new-project-card" data-go="create"><span>＋</span><strong>Start a new story</strong><small>Bring a movie into your studio</small></button>`;$$("[data-go]").forEach(b=>b.addEventListener("click",()=>go(b.dataset.go)));$("#totalProjects").textContent=String(projects.length).padStart(2,"0")}
$$(".filter").forEach(b=>b.addEventListener("click",()=>{ $$(".filter").forEach(x=>x.classList.toggle("active",x===b));const f=b.textContent.trim();const list=f==="All projects"?projects:projects.filter(p=>p.status===f.slice(0,-1)||p.status===f);$("#allProjects").innerHTML=list.map(card).join("")||'<p class="subtle-label">No projects in this category.</p>'}));
renderProjects();
