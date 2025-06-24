import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import LOCAL_STORAGE_KEYS from "@/shared/constants/localStorageKeys.js";

const useTokenValidation = (databaseApi, filmId = null, itemId = null) => {
  const [isValidToken, setIsValidToken] = useState(false);
  const [isValidFilm, setIsValidFilm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const token = useSelector(state => state.token.token);
  const tokenExpiry = useSelector(state => state.token.tokenExpiry);
  const dispatch = useDispatch();
  
  const validateToken = useCallback(async () => {
    if (!token) {
      setIsValidToken(false);
      setIsValidFilm(false);
      setIsLoading(false);
      
      if (filmId) {
        dispatch({ type: 'REMOVE_PAID_FILM', payload: filmId });
      }
      localStorage.removeItem(LOCAL_STORAGE_KEYS.PAID_FILMS);
      
      return;
    }
    
    if (tokenExpiry) {
      const expiryDate = new Date(tokenExpiry);
      if (expiryDate < new Date()) {
        dispatch({ type: 'REMOVE_TOKEN' });
        dispatch({ type: 'SET_PAID_FILMS', payload: [] });
        localStorage.removeItem(LOCAL_STORAGE_KEYS.PAID_FILMS);  
        setIsValidToken(false);
        setIsValidFilm(false);
        setIsLoading(false);
        
        if (filmId) {
          dispatch({ type: 'REMOVE_PAID_FILM', payload: filmId });
        }
        return;
      }
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      let url = `${databaseApi}api/tokens/validate/?token=${token}`;
      if (filmId) {
        url += `&film_id=${filmId}`;
      }
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.valid) {
          setIsValidToken(true);
          
          if (filmId) {
            const filmValid = data.film_valid || false;
            setIsValidFilm(filmValid);
            
            if (!filmValid && filmId) {
              dispatch({ type: 'REMOVE_PAID_FILM', payload: filmId });
            }
          } else {
            setIsValidFilm(true);
          }
          
          if (data.expires_at && data.expires_at !== tokenExpiry) {
            dispatch({ 
              type: 'SET_TOKEN', 
              payload: { 
                token, 
                expiry: data.expires_at 
              } 
            });
          }
        } else {
          setIsValidToken(false);
          setIsValidFilm(false);
          
          if (filmId) {
            dispatch({ type: 'REMOVE_PAID_FILM', payload: filmId });
          }
          
          if (data.error && data.error.includes("истек")) {
            dispatch({ type: 'REMOVE_TOKEN' });
            localStorage.removeItem(LOCAL_STORAGE_KEYS.PAID_FILMS); 
          }
        }
      } else {
        setIsValidToken(false);
        setIsValidFilm(false);
        setError("Ошибка при проверке");
      
        if (filmId) {
          dispatch({ type: 'REMOVE_PAID_FILM', payload: filmId });
        }
      }
    } catch (error) {
      setIsValidToken(false);
      setIsValidFilm(false);
      setError("Ошибка сети");
    } finally {
      setIsLoading(false);
    }
  }, [databaseApi, dispatch, token, tokenExpiry, filmId, itemId]);
  
  useEffect(() => {
    validateToken();
  }, [validateToken]);
  
  return { isValidToken, isValidFilm, isLoading, error, validateToken };
};

export default useTokenValidation;