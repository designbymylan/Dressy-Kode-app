/**
 * Ce qui ne se dit qu'une fois (10/11) : un indice de geste s'affiche tant
 * que le geste n'a pas été fait, puis plus jamais. La mémoire tient dans le
 * téléphone, à part de l'état de l'app : ce n'est pas une donnée personnelle,
 * juste « cet indice a servi ».
 */
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'dresskode:une-fois:';

export function useOnce(id: string): [boolean, () => void] {
  // Rien ne s'affiche tant qu'on ne sait pas : un indice qui clignote au lancement serait pire que pas d'indice.
  const [show, setShow] = useState(false);
  useEffect(() => {
    let on = true;
    AsyncStorage.getItem(KEY + id)
      .then((v) => {
        if (on && !v) setShow(true);
      })
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, [id]);
  const done = useCallback(() => {
    setShow(false);
    AsyncStorage.setItem(KEY + id, '1').catch(() => undefined);
  }, [id]);
  return [show, done];
}
