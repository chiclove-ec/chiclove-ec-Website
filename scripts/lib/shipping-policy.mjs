// Política estándar publicada: envío gratuito en Ecuador desde el mínimo del
// catálogo. No conocemos la tarifa bajo ese mínimo ni los tiempos de entrega.
// ShippingConditions expresa el umbral que Google admite para ShippingService;
// eligibleTransactionVolume no es una propiedad de OfferShippingDetails.
export function shippingPolicy({ base, freeShipping }) {
  return {
    "@type": "ShippingService",
    "@id": base + "#shipping",
    fulfillmentType: "https://schema.org/FulfillmentTypeDelivery",
    shippingConditions: {
      "@type": "ShippingConditions",
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "EC" },
      orderValue: { "@type": "MonetaryAmount", currency: "USD", minValue: freeShipping },
      shippingRate: { "@type": "MonetaryAmount", currency: "USD", value: 0 }
    }
  };
}
