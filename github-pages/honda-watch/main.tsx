import React from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from '../../app/Dashboard';
import '../../app/globals.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><Dashboard readOnly initialPage="Honda early warning" assetBase="../"/></React.StrictMode>);
