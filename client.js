window.__ModuleLoader__.load({
  id: 'dsh-version-sentinel',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const en = { title:'DSH version sentinel', entry:'Version sentinel', stable:'Stable', prerelease:'Prerelease', current:'Running version', check:'Check now', checking:'Checking…', close:'Close', all:'All releases', none:'No releases in this channel', empty:'No releases loaded', upToDate:'No newer version found', available:'New DSH version available', view:'Choose a version', dismiss:'Dismiss notice', date:'Published', select:'Select a newer version', prepare:'Prepare update', confirm:'Confirm preparation', cancel:'Cancel', selected:'Selected version', warning:'Prerelease: Alpha / Beta / RC may be unstable.', safety:'Downloads into a separate directory. Does not overwrite this installation or restart any session. Switching to the new version requires a manual restart following the generated instructions.', source:'Checks npm, with a mainland China npm mirror fallback. The “latest” tag does not imply stable.', apiMissing:'The update backend did not load. Reload the plugin or check its activation error.', badResponse:'The update service returned an invalid response', sourceLabel:'Version source', attempted:'Last attempt', old:'Older version — not an upgrade', running:'Running', newer:'Newer', last:'Last checked', retry:'Check failed — retry', loading:'Loading…', pending:'Preparing update…', success:'Prepared, not activated', failure:'Preparation failed', noStable:'No stable release published', note:'Preparation uses --ignore-scripts; native dependencies may need manual setup. Read the generated instructions before switching.', ready:'Preparation result', error:'Request failed', published:'Published versions', stale:'Check failed; the list may be outdated', legacy:'Deprecated', updating:'Preparation status' };
    const zh = { title:'DSH 版本哨兵', entry:'版本哨兵', stable:'正式版', prerelease:'预发布版', current:'当前运行版本', check:'立即检查', checking:'正在检查…', close:'关闭', all:'全部版本', none:'此通道暂无版本', empty:'尚未加载版本列表', upToDate:'暂无更新版本', available:'发现 DSH 新版本', view:'查看并选择版本', dismiss:'稍后提醒', date:'发布时间', select:'选择要更新的新版', prepare:'下载并准备更新', confirm:'确认准备更新', cancel:'取消', selected:'所选版本', warning:'预发布版：Alpha / Beta / RC 可能不稳定，不等同正式版。', safety:'在独立目录下载准备，不覆盖当前安装、不重启任何会话。完成后需按生成的说明手动重启并切换新版。', source:'启动自动检查 npm，连接失败时尝试国内 npm 镜像。“latest”标签不代表正式版。', apiMissing:'更新后端未加载，请重新加载插件或检查启用错误。', badResponse:'更新服务返回了无效响应', sourceLabel:'版本来源', attempted:'最近尝试', old:'旧版本 · 不可作为升级', running:'正在运行', newer:'可更新', last:'上次检查', retry:'检查失败，点击重试', loading:'正在加载…', pending:'正在准备更新…', success:'已准备，尚未启用', failure:'准备更新失败', noStable:'暂无已发布的正式版', note:'准备阶段使用 --ignore-scripts；原生依赖可能需要手动安装。切换前请阅读生成的说明。', ready:'准备结果', error:'请求失败', published:'已发布版本', stale:'检查失败，保留的列表可能已过期', legacy:'已弃用', updating:'准备状态' };
    const css = `.duc-btn{font:inherit;cursor:pointer;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:7px 11px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}.duc-btn:hover{background:var(--dsw-alias-bg-layer-2)}.duc-btn:focus-visible,.duc-row:focus-within{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}.duc-btn:disabled{opacity:.5;cursor:not-allowed}.duc-primary,.duc-primary:hover{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-bg-base)}.duc-stable{color:var(--dsw-alias-state-success-primary)}.duc-prerelease{color:var(--dsw-alias-state-warn-primary)}.duc-tag{display:inline-block;font-size:12px;font-weight:600;padding:2px 7px;border:1px solid currentColor;border-radius:5px;white-space:nowrap}.duc-muted{color:var(--dsw-alias-label-secondary);font-size:12px}.duc-error{color:var(--dsw-alias-state-error-primary)}.duc-dialog{pointer-events:auto;width:min(700px,calc(100vw - 32px));max-height:85vh;box-sizing:border-box;padding:24px;border:1px solid var(--dsw-alias-border-l2);border-radius:16px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);font:14px/1.6 system-ui;overflow:auto}.duc-dialog::backdrop{background:color-mix(in srgb,var(--dsw-alias-label-primary) 30%,transparent)}.duc-top{display:flex;gap:12px;align-items:center;justify-content:space-between}.duc-row{display:flex;gap:12px;align-items:center;border-bottom:1px solid var(--dsw-alias-border-l1);padding:12px 4px}.duc-row:has(input:checked){background:var(--dsw-alias-bg-layer-2)}.duc-panel{padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;margin:14px 0;background:var(--dsw-alias-bg-layer-1)}.duc-list{max-height:32vh;overflow:auto}.duc-footer{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.duc-notice{pointer-events:auto;position:fixed;right:20px;top:65px;max-width:min(330px,calc(100vw - 40px));background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:14px;color:var(--dsw-alias-label-primary);font:13px/1.6 system-ui}.duc-entry{position:relative;font-size:12px;white-space:nowrap}.duc-btn.duc-update{display:flex;align-items:center;justify-content:center;width:46px;min-height:46px;padding:5px;color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}.duc-result{white-space:pre-wrap;overflow-wrap:anywhere;max-height:140px;overflow:auto;font-size:12px}`;
    return {
      inject:['slots','locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('dsh-update-center','en',en));
        ctx.effect(() => ctx.locale.register('dsh-update-center','zh',zh));
        const t = ctx.locale.bind('dsh-update-center');
        let state = { data:null, error:'', open:false, busy:false, dismissed:'' };
        const listeners = new Set();
        const set = patch => { state = {...state,...patch}; listeners.forEach(fn=>fn()); };
        const controller = new AbortController();
        const request = async (action, body) => {
          const response = await fetch('/api/local-dsh-update-center'+action, {
            credentials:'same-origin', signal:controller.signal,
            ...(body ? {method:'POST',headers:{'Content-Type':'application/json','X-DSH-Update':'1'},body:JSON.stringify(body)} : {}),
          });
          const text = await response.text();
          let data;
          try { data = JSON.parse(text); } catch {
            throw new Error(response.status === 404 ? t('apiMissing') : t('badResponse')+' (HTTP '+response.status+')');
          }
          if (!response.ok) throw new Error(data.error || t('error')+' (HTTP '+response.status+')');
          if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(t('badResponse'));
          return data;
        };
        async function refresh(force=false) {
          if (state.busy) return;
          set({busy:true});
          try { const data = await request(force?'/check':'',force?{}:null); set({data,error:''}); }
          catch(e) { if(!controller.signal.aborted) set({error:e.message}); }
          finally { if(!controller.signal.aborted) set({busy:false}); }
        }
        function useState() {
          React.useSyncExternalStore(fn=>{listeners.add(fn);return ()=>listeners.delete(fn);},()=>state);
          React.useSyncExternalStore(fn=>ctx.locale.subscribe(fn),()=>ctx.locale.getSnapshot());
          return state;
        }
        const badge = channel => h('span',{className:'duc-tag duc-'+channel},t(channel));
        function Entry({wide}) {
          const s=useState(); const d=s.data; const update=!s.error&&!d?.error&&(d?.hasStableUpdate||d?.hasPrereleaseUpdate);
          const arrow=h('svg',{width:34,height:34,viewBox:'0 0 36 36','aria-hidden':true,fill:'none'},h('path',{d:'M18 30V6M7 17 18 6l11 11',stroke:'currentColor',strokeWidth:4,strokeLinecap:'round',strokeLinejoin:'round'}));
          return h('button',{type:'button',className:'duc-btn duc-entry'+(update?' duc-update':''),'aria-label':t('entry')+(update?' · '+t('available'):''),title:(s.error||d?.error?t('retry'):update?t('available'):t('entry'))+(d?.current?' · '+d.current:''),onClick:()=>set({open:true})}, update?arrow:wide?t('entry'):'↑');
        }
        function Overlay() {
          const s=useState(),d=s.data; const [filter,setFilter]=React.useState('all'); const [selected,choose]=React.useState(''); const [confirm,setConfirm]=React.useState(false); const [preparing,setPreparing]=React.useState(false); const [result,setResult]=React.useState(null); const [failure,setFailure]=React.useState('');
          const dialog=React.useRef(null),previous=React.useRef(null);
          React.useEffect(()=>{
            if(s.open){previous.current=document.activeElement;dialog.current?.showModal();void refresh();}
            else if(dialog.current?.open){dialog.current.close();previous.current?.focus?.();setConfirm(false);}
          },[s.open]);
          const newer=r=>r.newer===true && r.packageAvailable!==false;
          const checking=s.busy||(!d?.checkedAt&&!s.error&&!d?.error);
          const releases=d?.releases||[];
          const current=typeof d?.current==='string'?d.current:d?.current?.version;
          const updates=[d?.hasStableUpdate?d.latestStable:null,d?.hasPrereleaseUpdate?d.latestPrerelease:null].filter(Boolean);
          const signature=!s.error&&!d?.error?updates.map(v=>typeof v==='string'?v:v.version).join('|'):'';
          const job=d?.job || result?.job;
          const working=preparing || job?.status==='preparing';
          const selectedRelease=releases.find(r=>r.version===selected);
          async function prepare(){setPreparing(true);setFailure('');try{const value=await request('/prepare',{version:selected,confirm:true});setResult(value);setConfirm(false);await refresh();}catch(e){setFailure(e.message);}finally{setPreparing(false);}}
          return h(React.Fragment,null,h('style',null,css),h('span',{role:'status','aria-live':'polite',style:{position:'absolute',width:1,height:1,overflow:'hidden',clipPath:'inset(50%)'}},signature?t('available')+' '+signature:''),
            h('dialog',{ref:dialog,className:'duc-dialog','aria-labelledby':'duc-title',onCancel:()=>set({open:false}),onClose:()=>{if(state.open)set({open:false});}},
              h('header',{className:'duc-top'},h('h2',{id:'duc-title',style:{margin:0,fontSize:20}},t('title')),h('button',{className:'duc-btn',onClick:()=>set({open:false})},t('close'))),
              h('section',{className:'duc-panel'},h('div',{className:'duc-muted'},t('current')),h('strong',{style:{fontSize:18}},current||'—'),' ',current&&badge(current.includes('-')?'prerelease':'stable'),h('div',{className:'duc-muted'},t('source'))),
              h('div',{className:'duc-top'},h('span',{role:'status','aria-live':'polite'},checking?t('checking'):s.error||d?.error?t('retry'):signature?t('available'):t('upToDate')),h('button',{className:'duc-btn',disabled:s.busy,onClick:()=>refresh(true)},t(s.busy?'checking':'check'))),
              h('div',{className:'duc-muted'},t('last')+': '+(d?.checkedAt?new Date(d.checkedAt).toLocaleString():'—')),
              d?.source&&h('div',{className:'duc-muted'},t('sourceLabel')+': '+d.source.label+(d.source.notice?' · '+d.source.notice:'')),
              d?.lastAttemptAt&&d?.error&&h('div',{className:'duc-muted'},t('attempted')+': '+new Date(d.lastAttemptAt).toLocaleString()),
              (s.error||d?.error)&&h('p',{role:'alert',className:'duc-error'},t('stale')+' · '+(s.error||d.error)),
              !d&&!s.error?h('p',null,t('loading')):null,
              h('div',{className:'duc-footer','aria-label':t('published')},['all','stable','prerelease'].map(channel=>h('button',{className:'duc-btn',key:channel,'aria-pressed':filter===channel,onClick:()=>{setFilter(channel);choose('');setConfirm(false);setResult(null);setFailure('');}},t(channel)))),
              d?.checkedAt&&!s.error&&!d?.error&&filter==='stable'&&!releases.some(r=>r.channel==='stable')&&h('p',null,t('noStable')),
              h('div',{className:'duc-list',role:'radiogroup','aria-label':t('select')},releases.filter(r=>filter==='all'||r.channel===filter).map(r=>h('label',{key:r.version,className:'duc-row'},h('input',{type:'radio',name:'duc-version',value:r.version,checked:selected===r.version,disabled:!newer(r)||!!r.deprecated||working,onChange:()=>{choose(r.version);setConfirm(false);setResult(null);setFailure('');}}),h('div',{style:{flex:1}},h('strong',null,r.version),' ',badge(r.channel),h('div',{className:'duc-muted'},r.publishedAt?new Date(r.publishedAt).toLocaleDateString():''),' ',(r.tags||[]).map(tag=>h('small',{key:tag},' '+tag))),h('small',{className:'duc-muted'},t(r.deprecated?'legacy':r.version===current?'running':newer(r)?'newer':'old'))))),
              h('p',{className:'duc-muted'},t('safety')),h('p',{className:'duc-muted'},t('note')),
              selectedRelease?.channel==='prerelease'&&h('p',{className:'duc-prerelease'},t('warning')),
              failure&&h('p',{className:'duc-error',role:'alert'},failure),
              confirm?h('section',{className:'duc-panel'},h('strong',null,t('selected')+': '+selected),h('p',null,t('safety')),h('div',{className:'duc-footer'},h('button',{className:'duc-btn duc-primary',disabled:preparing,onClick:prepare},t(preparing?'pending':'confirm')),h('button',{className:'duc-btn',disabled:preparing,onClick:()=>setConfirm(false)},t('cancel')))):h('button',{className:'duc-btn duc-primary',disabled:!selectedRelease||!newer(selectedRelease)||!!selectedRelease.deprecated||working||!!d?.error||!!s.error,onClick:()=>setConfirm(true)},t('prepare')),
              job?.status&&job.status!=='idle'&&h('section',{className:'duc-panel','aria-live':'polite'},h('strong',{className:job.status==='failed'?'duc-error':''},t(job.status==='preparing'?'pending':job.status==='pending-manual'?'success':job.status==='failed'?'failure':'updating')),h('p',{className:'duc-result'},job.message),job.path&&h('div',{className:'duc-result'},job.path),job.status==='pending-manual'&&h('p',{className:'duc-muted'},t('safety')))
            ));
        }
        ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'local-dsh-update-center',order:5},Entry));
        ctx.slots.inject('shell.overlay',()=>ctx.slots.register({name:'shell.overlay',id:'local-dsh-update-center',order:50},Overlay));
        ctx.effect(()=>{void refresh();const timer=setInterval(()=>refresh(),60*1000);const progress=setInterval(()=>{const d=state.data;if(d&&(!d.checkedAt&&!d.error||d.job?.status==='preparing'))void refresh();},3000);return()=>{clearInterval(timer);clearInterval(progress);controller.abort();listeners.clear();};});
      },
    };
  },
});
