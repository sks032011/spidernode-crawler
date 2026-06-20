import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

function App() {
  const [metrics, setMetrics] = useState({
    queue: { waiting: 0, active: 0, completed: 0, failed: 0 },
    database: { totalSaved: 0 }
  });
  
  const [recentPages, setRecentPages] = useState([]); 
  const [seedUrl, setSeedUrl] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  useEffect(() => {
    // 1. Safe Socket Initialization
    const socket = io('http://localhost:5000');

    // 2. Fetch initial state
    fetch('http://localhost:5000/api/stats')
      .then(res => res.json())
      .then(data => {
        setMetrics({ queue: data.queue, database: data.database });
        if (data.recentPages) setRecentPages(data.recentPages);
      })
      .catch(err => console.error("Failed to load initial stats", err));

    // 3. Listen for live updates
    socket.on('metrics_update', (data) => {
      setMetrics({ queue: data.queue, database: data.database });
      if (data.recentPages) setRecentPages(data.recentPages);
    });

    // 4. Clean memory sweep
    return () => {
      socket.off('metrics_update');
      socket.disconnect();
    };
  }, []);

  const handleStartCrawl = async () => {
    if (!seedUrl) return;
    setStatusMsg('Initiating...');
    
    try {
      const res = await fetch('http://localhost:5000/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: seedUrl })
      });
      const data = await res.json();
      
      if (data.success) {
        setStatusMsg('Crawl Started!');
        setSeedUrl('');
      } else {
        setStatusMsg(' Error: ' + data.error);
      }
    } catch (err) {
      setStatusMsg(' Server not responding.');
    }
    setTimeout(() => setStatusMsg(''), 3000); 
  };

  const handleStopCrawl = async () => {
    setStatusMsg('Stopping...');
    try {
      const res = await fetch('http://localhost:5000/api/stop', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(' Crawl Stopped!');
      }
    } catch (err) {
      setStatusMsg('Failed to stop.');
    }
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleResetSystem = async () => {
    if (!window.confirm("Are you sure? This will wipe the Queue, Redis cache, and MongoDB database.")) return;
    
    setStatusMsg('Wiping system...');
    try {
      const res = await fetch('http://localhost:5000/api/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatusMsg('System Wiped Clean');
        setMetrics({
          queue: { waiting: 0, active: 0, completed: 0, failed: 0 },
          database: { totalSaved: 0 }
        });
        setRecentPages([]);
      }
    } catch (err) {
      setStatusMsg('Reset failed.');
    }
    setTimeout(() => setStatusMsg(''), 3000);
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh' }}>
      
      {/* Header & Controls */}
      <div style={{ borderBottom: '1px solid #334155', paddingBottom: '20px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#38bdf8' }}>🕷️ SpiderNode Command Center</h1>
          <p style={{ color: '#94a3b8', margin: '5px 0 0 0' }}>Distributed Crawler Engine</p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="text" 
            placeholder="https://example.com" 
            value={seedUrl}
            onChange={(e) => setSeedUrl(e.target.value)}
            style={{ padding: '10px 15px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', width: '300px' }}
          />
          <button 
            onClick={handleStartCrawl}
            style={{ padding: '10px 20px', backgroundColor: '#38bdf8', color: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseOver={(e) => e.target.style.opacity = 0.8}
            onMouseOut={(e) => e.target.style.opacity = 1}
          >
            LAUNCH
          </button>
          <button 
            onClick={handleStopCrawl}
            style={{ padding: '10px 20px', backgroundColor: '#fbbf24', color: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'opacity 0.2s' }}
            onMouseOver={(e) => e.target.style.opacity = 0.8}
            onMouseOut={(e) => e.target.style.opacity = 1}
          >
            STOP
          </button>
          <button 
            onClick={handleResetSystem}
            style={{ padding: '10px 20px', backgroundColor: 'transparent', color: '#f87171', border: '1px solid #f87171', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', transition: 'background-color 0.2s' }}
            onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(248, 113, 113, 0.1)'}
            onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            RESET
          </button>
          
          {statusMsg && (
            <span style={{ 
              color: statusMsg.startsWith('❌') ? '#f87171' : (statusMsg.startsWith('🛑') ? '#fbbf24' : '#34d399'), 
              fontSize: '14px', 
              marginLeft: '10px',
              fontWeight: '500'
            }}>
              {statusMsg}
            </span>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        <StatCard title="Waiting in Queue" value={metrics.queue.waiting} color="#fbbf24" />
        <StatCard title="Active Jobs" value={metrics.queue.active} color="#34d399" />
        <StatCard title="Jobs Completed" value={metrics.queue.completed} color="#60a5fa" />
        <StatCard title="MongoDB Documents" value={metrics.database.totalSaved} color="#c084fc" isHighlight={true} />
        <StatCard title="Failed / Blocked" value={metrics.queue.failed} color="#f87171" />
      </div>

      {/* Live Activity Feed */}
      <div style={{ marginTop: '40px', backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' }}>
        <div style={{ padding: '15px 24px', backgroundColor: '#0f172a', borderBottom: '1px solid #334155' }}>
          <h2 style={{ margin: 0, fontSize: '16px', color: '#38bdf8', textTransform: 'uppercase' }}>Live Scrape Feed</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {recentPages.map((page, index) => (
            <div key={page.url + index} style={{ padding: '16px 24px', borderBottom: index !== recentPages.length - 1 ? '1px solid #334155' : 'none' }}>
              <div style={{ color: '#f8fafc', fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>{page.title}</div>
              <div style={{ color: '#94a3b8', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <a href={page.url} target="_blank" rel="noreferrer" style={{ color: '#34d399', textDecoration: 'none' }}>
                  {page.url}
                </a>
              </div>
            </div>
          ))}
          {recentPages.length === 0 && (
            <div style={{ padding: '24px', color: '#94a3b8', textAlign: 'center', fontStyle: 'italic' }}>
              Awaiting data...
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function StatCard({ title, value, color, isHighlight }) {
  return (
    <div style={{ 
      backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', 
      border: isHighlight ? `2px solid ${color}` : '1px solid #334155',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }}>
      <h3 style={{ color: '#94a3b8', fontSize: '14px', textTransform: 'uppercase', margin: '0 0 10px 0' }}>{title}</h3>
      <span style={{ fontSize: '36px', fontWeight: 'bold', color: color }}>
        {(value ?? 0).toLocaleString()}
      </span>
    </div>
  );
}

export default App;