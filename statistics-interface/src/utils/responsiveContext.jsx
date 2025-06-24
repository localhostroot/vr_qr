import React, { createContext, useContext } from 'react';
import { useMediaQuery } from 'react-responsive';

const ResponsiveContext = createContext();

export const ResponsiveProvider = ({ children }) => {
    const isPhone = useMediaQuery({ query: '(max-width: 767px)' });
    const isTablet = useMediaQuery({ query: '(min-width: 768px) and (max-width: 1100px)' });
    const isDesktop = useMediaQuery({ query: '(min-width: 1101px)' });

    return (
        <ResponsiveContext.Provider value={{ isPhone, isTablet, isDesktop }}>
            {children}
        </ResponsiveContext.Provider>
    );
};

export const useResponsive = () => {
    return useContext(ResponsiveContext);
};