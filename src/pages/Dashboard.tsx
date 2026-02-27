import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../components/Header';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-pattern">
      <Header />
      <main>
        <Outlet />
      </main>
    </div>
  );
}