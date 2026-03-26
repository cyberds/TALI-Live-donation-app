"use client";
import React, { createContext, useContext, useState } from 'react';

interface EventData {
   id: number;
   title: string;
   is_active: boolean;
}

interface AdminContextProps {
   selectedEventId: number | null;
   setSelectedEventId: (id: number) => void;
   events: EventData[];
   setEvents: (e: EventData[]) => void;
}

export const AdminContext = createContext<AdminContextProps>({
   selectedEventId: null,
   setSelectedEventId: () => {},
   events: [],
   setEvents: () => {}
});

export function useAdminContext() { 
   return useContext(AdminContext); 
}
