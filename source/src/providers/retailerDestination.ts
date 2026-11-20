import { Alert } from 'react-native';
import * as Linking from 'expo-linking';
import type { Product } from '../domain/types';
import { retailerProductUrl } from '../domain/retailer';
export interface RetailerDestination { viewProduct(product: Product): Promise<void>; }
export const retailerDestination: RetailerDestination = {
  async viewProduct(product) {
    const url = retailerProductUrl(product);
    if (!url) {
      Alert.alert('Sample piece', 'This saved demo item has no verified retailer listing. Browse Home for real shoppable pieces.');
      return;
    }
    try { await Linking.openURL(url); }
    catch { Alert.alert('Could not open retailer', 'Please try again. The current price, sizing and availability are confirmed on the retailer website.'); }
  },
};
