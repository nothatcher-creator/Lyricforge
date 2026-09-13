const clone = v => structuredClone(v);
export class History {
  constructor(initial, limit=100){ this.limit=limit; this.past=[]; this.present=clone(initial); this.future=[]; }
  current(){ return clone(this.present); }
  push(next){ this.past.push(clone(this.present)); if(this.past.length>this.limit)this.past.shift(); this.present=clone(next); this.future=[]; return this.current(); }
  undo(){ if(!this.past.length)return this.current(); this.future.unshift(clone(this.present)); this.present=this.past.pop(); return this.current(); }
  redo(){ if(!this.future.length)return this.current(); this.past.push(clone(this.present)); this.present=this.future.shift(); return this.current(); }
  canUndo(){ return this.past.length>0; } canRedo(){ return this.future.length>0; }
  reset(next){ this.past=[]; this.future=[]; this.present=clone(next); }
}
