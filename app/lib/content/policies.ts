/**
 * Storefront policy documents.
 *
 * Shopify exposes four shop policies through the Storefront API (privacy,
 * shipping, terms of service, refund) plus the subscription policy. The
 * documents below are the storefront's own copies of those four, served when
 * the store has not published a policy in Settings → Policies yet, and the two
 * documents Shopify does not expose through the API at all (contact
 * information and legal notice), which the storefront always serves.
 *
 * Bracketed placeholders such as [Store Name] and [Email] are filled in by the
 * merchant. Bodies are trusted HTML authored by the merchant, rendered as is.
 */

export type StorefrontPolicy = {
  handle: string;
  title: string;
  /** Short blurb shown on the policies index. */
  description: string;
  /** Friendly headline of the page banner, e.g. "Sleep Easy, Your Data's Safe". */
  heroHeadline: string;
  /** One line of reassurance under the headline. */
  heroSubheadline: string;
  /** Banner photo (placeholder art until the merchant uploads imagery). */
  heroImage: {url: string; altText: string; width: number; height: number};
  /** HTML body. */
  body: string;
  /** Shopify field this document stands in for; `null` when Shopify has none. */
  shopField:
    | 'privacyPolicy'
    | 'shippingPolicy'
    | 'termsOfService'
    | 'refundPolicy'
    | null;
};

const REFUND_POLICY = `
<p>Thank you for shopping with [Store Name]. We want you to love your new bedding. If you are not completely happy with your purchase, we are here to help. This policy explains how returns, refunds and exchanges work.</p>

<h2>Return Window</h2>
<p>You can request a return within 30 days of receiving your order.</p>
<p>To qualify for a return, your item must be:</p>
<ul>
<li>Unused, unwashed and not slept on</li>
<li>In the same condition you received it, free from stains, odours, pet hair and damage</li>
<li>Returned in its original packaging with all labels and inserts included</li>
<li>Returned with any matching items sold as a set (for example, a duvet cover and pillowcases sold together)</li>
</ul>

<h2>Hygiene and Sealed Items</h2>
<p>For hygiene reasons, the following items can only be returned if they are unopened and still in their original sealed packaging:</p>
<ul>
<li>Pillows</li>
<li>Duvets, quilts and comforters</li>
<li>Mattress toppers and mattress protectors</li>
<li>Any other filled or padded sleep products</li>
</ul>
<p>Once the seal or protective packaging on these items has been opened or removed, they cannot be returned unless they are faulty, damaged or incorrect. This does not affect your rights if an item arrives faulty, damaged or not as described.</p>
<p>Sheets, pillowcases, duvet covers and blankets may be returned if they have been taken out of their packaging to check them, as long as they are unused, unwashed and in perfect condition.</p>

<h2>Faulty, Damaged or Incorrect Items</h2>
<p>If your item arrives faulty, damaged, or is not what you ordered, please contact us within 30 days of delivery with your order number and photos of the issue. We will cover the cost of the return and offer you a replacement or a full refund, depending on availability and your preference.</p>

<h2>Change of Mind</h2>
<p>If you would like to return an item because of its size, colour, feel or firmness, or simply because you changed your mind, you are responsible for the cost of return shipping. Original shipping charges are non-refundable. We do not charge restocking fees.</p>
<p>Please note that larger items such as duvets and pillows may cost more to send back. We recommend using a tracked service, as we are not responsible for returns lost in transit.</p>

<h2>Non-Returnable Items</h2>
<p>The following cannot be returned unless faulty, damaged or incorrect:</p>
<ul>
<li>Filled items (such as pillows, duvets and toppers) that have been removed from their sealed packaging</li>
<li>Any item that has been used, washed, slept on or altered</li>
<li>Personalised or made-to-order items</li>
<li>Gift cards</li>
<li>Sale items marked "final sale"</li>
</ul>

<h2>How to Start a Return</h2>
<ol>
<li>Contact us at [Email] with your order number, the item(s) you would like to return and the reason for the return.</li>
<li>We will reply with return instructions and the return address. Items sent back without first requesting a return will not be accepted.</li>
<li>Pack your item securely in its original packaging so it stays clean and protected during transit, then send it using a tracked shipping service.</li>
</ol>

<h2>Refunds</h2>
<p>Once we receive your return, we will inspect it to make sure it meets the conditions above and let you know whether it has been approved. Approved refunds are issued to your original payment method. Please allow up to 7 business days for the refund to appear, as processing times vary between banks and card providers.</p>
<p>If a returned item shows signs of use, washing or damage that was not present when it was sent, we may refuse the return or reduce the refund to reflect the loss in value.</p>
<p>If you have not received your refund after this time, please check with your bank first, then contact us at [Email].</p>
<p>All refunds are processed in GBP (£).</p>

<h2>Exchanges</h2>
<p>If you would like a different size (for example, Single, Double, King or Super King), colour or fill, please contact us before sending your item back. We will check stock availability and explain how to arrange the exchange.</p>

<h2>Cancellations</h2>
<p>You may cancel your order free of charge before it has been dispatched by contacting us as soon as possible at [Email]. Once an order has been dispatched, it can no longer be cancelled and must be returned following the steps above.</p>

<h2>Your Statutory Rights</h2>
<p>This policy does not affect your statutory rights as a consumer under the Consumer Rights Act 2015 and the Consumer Contracts Regulations 2013. Under these regulations, the right to cancel does not apply to sealed goods that are not suitable for return for health protection or hygiene reasons once they have been unsealed after delivery.</p>

<h2>Questions</h2>
<p>If you have any questions about returns or refunds, contact us at [Email] or [Phone]. Our customer service team is available [Monday to Friday, 9:00 AM – 5:00 PM GMT].</p>
`;

const PRIVACY_POLICY = `
<p>Last updated: October 26, 2026</p>
<p>My Store operates this store and website, including all related information, content, features, tools, products and services, in order to provide you, the customer, with a curated shopping experience (the "Services"). My Store is powered by Shopify, which enables us to provide the Services to you. This Privacy Policy describes how we collect, use, and disclose your personal information when you visit, use, or make a purchase or other transaction using the Services or otherwise communicate with us. If there is a conflict between our Terms of Service and this Privacy Policy, this Privacy Policy controls with respect to the collection, processing, and disclosure of your personal information.</p>
<p>Please read this Privacy Policy carefully. By using and accessing any of the Services, you acknowledge that you have read this Privacy Policy and understand the collection, use, and disclosure of your information as described in this Privacy Policy.</p>
<h2>Personal Information We Collect or Process</h2>
<p>When we use the term "personal information," we are referring to information that identifies or can reasonably be linked to you or another person. Personal information does not include information that is collected anonymously or that has been de-identified, so that it cannot identify or be reasonably linked to you. We may collect or process the following categories of personal information, including inferences drawn from this personal information, depending on how you interact with the Services, where you live, and as permitted or required by applicable law:</p>
<ul>
<li><strong>Contact details</strong> including your name, address, billing address, shipping address, phone number, and email address.</li>
<li><strong>Financial information</strong> including credit card, debit card, and financial account numbers, payment card information, financial account information, transaction details, form of payment, payment confirmation and other payment details.</li>
<li><strong>Account information</strong> including your username, password, security questions, preferences and settings.</li>
<li><strong>Transaction information</strong> including the items you view, put in your cart, add to your wishlist, or purchase, return, exchange or cancel and your past transactions.</li>
<li><strong>Communications with us</strong> including the information you include in communications with us, for example, when sending a customer support inquiry.</li>
<li><strong>Device information</strong> including information about your device, browser, or network connection, your IP address, and other unique identifiers.</li>
<li><strong>Usage information</strong> including information regarding your interaction with the Services, including how and when you interact with or navigate the Services.</li>
</ul>
<h2>Personal Information Sources</h2>
<p>We may collect personal information from the following sources:</p>
<ul>
<li><strong>Directly from you</strong> including when you create an account, visit or use the Services, communicate with us, or otherwise provide us with your personal information;</li>
<li><strong>Automatically through the Services</strong> including from your device when you use our products or services or visit our websites, and through the use of cookies and similar technologies;</li>
<li><strong>From our service providers</strong> including when we engage them to enable certain technology and when they collect or process your personal information on our behalf;</li>
<li><strong>From our partners or other third parties.</strong></li>
</ul>
<h2>How We Use Your Personal Information</h2>
<p>Depending on how you interact with us or which of the Services you use, we may use personal information for the following purposes:</p>
<ul>
<li><strong>Provide, Tailor, and Improve the Services.</strong> We use your personal information to provide you with the Services, including to perform our contract with you, to process your payments, to fulfill your orders, to remember your preferences and items you are interested in, to send notifications to you related to your account, to process purchases, returns, exchanges or other transactions, to create, maintain and otherwise manage your account, to arrange for shipping, to facilitate any returns and exchanges, to enable you to post reviews, and to create a customized shopping experience for you, such as recommending products related to your purchases. This may include using your personal information to better tailor and improve the Services.</li>
<li><strong>Marketing and Advertising.</strong> We use your personal information for marketing and promotional purposes, such as to send marketing, advertising and promotional communications by email, text message or postal mail, and to show you online advertisements for products or services on the Services or other websites, including based on items you previously have purchased or added to your cart and other activity on the Services.</li>
<li><strong>Security and Fraud Prevention.</strong> We use your personal information to authenticate your account, to provide a secure payment and shopping experience, detect, investigate or take action regarding possible fraudulent, illegal, unsafe, or malicious activity, protect public safety, and to secure our services. If you choose to use the Services and register an account, you are responsible for keeping your account credentials safe. We highly recommend that you do not share your username, password or other access details with anyone else.</li>
<li><strong>Communicating with You.</strong> We use your personal information to provide you with customer support, to be responsive to you, to provide effective services to you and to maintain our business relationship with you.</li>
<li><strong>Legal Reasons.</strong> We use your personal information to comply with applicable law or respond to valid legal process, including requests from law enforcement or government agencies, to investigate or participate in civil discovery, potential or actual litigation, or other adversarial legal proceedings, and to enforce or investigate potential violations of our terms or policies.</li>
</ul>
<h2>How We Disclose Personal Information</h2>
<p>In certain circumstances, we may disclose your personal information to third parties for legitimate purposes subject to this Privacy Policy. Such circumstances may include:</p>
<ul>
<li>With Shopify, vendors and other third parties who perform services on our behalf (e.g. IT management, payment processing, data analytics, customer support, cloud storage, fulfillment and shipping).</li>
<li>With business and marketing partners to provide marketing services and advertise to you. For example, we use Shopify to support personalized advertising with third-party services based on your online activity with different merchants and websites. Our business and marketing partners will use your information in accordance with their own privacy notices. Depending on where you reside, you may have a right to direct us not to share information about you to show you targeted advertisements and marketing based on your online activity with different merchants and websites.</li>
<li>When you direct, request us or otherwise consent to our disclosure of certain information to third parties, such as to ship you products or through your use of social media widgets or login integrations.</li>
<li>With our affiliates or otherwise within our corporate group.</li>
<li>In connection with a business transaction such as a merger or bankruptcy, to comply with any applicable legal obligations (including to respond to subpoenas, search warrants and similar requests), to enforce any applicable terms of service or policies, and to protect or defend the Services, our rights, and the rights of our users or others.</li>
</ul>
<h2>Relationship with Shopify</h2>
<p>The Services are hosted by Shopify, which collects and processes personal information about your access to and use of the Services in order to provide and improve the Services for you. Information you submit to the Services will be transmitted to and shared with Shopify as well as third parties that may be located in countries other than where you reside, in order to provide and improve the Services for you. In addition, to help protect, grow, and improve our business, we use certain Shopify enhanced features that incorporate data and information obtained from your interactions with our Store, along with other merchants and with Shopify. To provide these enhanced features, Shopify may make use of personal information collected about your interactions with our store, along with other merchants, and with Shopify. In these circumstances, Shopify is responsible for the processing of your personal information, including for responding to your requests to exercise your rights over use of your personal information for these purposes. To learn more about how Shopify uses your personal information and any rights you may have, you can visit the <a href="https://www.shopify.com/legal/privacy/app-users">Shopify Consumer Privacy Policy</a>. Depending on where you live, you may exercise certain rights with respect to your personal information here: <a href="https://privacy.shopify.com/en">Shopify Privacy Portal</a>.</p>
<h2>Third Party Websites and Links</h2>
<p>The Services may provide links to websites or other online platforms operated by third parties. If you follow links to sites not affiliated or controlled by us, you should review their privacy and security policies and other terms and conditions. We do not guarantee and are not responsible for the privacy or security of such sites, including the accuracy, completeness, or reliability of information found on these sites. Information you provide on public or semi-public venues, including information you share on third-party social networking platforms may also be viewable by other users of the Services and/or users of those third-party platforms without limitation as to its use by us or by a third party. Our inclusion of such links does not, by itself, imply any endorsement of the content on such platforms or of their owners or operators, except as disclosed on the Services.</p>
<h2>Children's Data</h2>
<p>The Services are not intended to be used by children, and we do not knowingly collect any personal information about children under the age of majority in your jurisdiction. If you are the parent or guardian of a child who has provided us with their personal information, you may contact us using the contact details set out below to request that it be deleted. As of the Effective Date of this Privacy Policy, we do not have actual knowledge that we "share" or "sell" (as those terms are defined in applicable law) personal information of individuals under 16 years of age.</p>
<h2>Security and Retention of Your Information</h2>
<p>Please be aware that no security measures are perfect or impenetrable, and we cannot guarantee "perfect security." In addition, any information you send to us may not be secure while in transit. We recommend that you do not use unsecure channels to communicate sensitive or confidential information to us.</p>
<p>How long we retain your personal information depends on different factors, such as whether we need the information to maintain your account, to provide you with Services, comply with legal obligations, resolve disputes or enforce other applicable contracts and policies.</p>
<h2>Your Rights and Choices</h2>
<p>Depending on where you live, you may have some or all of the rights listed below in relation to your personal information. However, these rights are not absolute, may apply only in certain circumstances and, in certain cases, we may decline your request as permitted by law.</p>
<ul>
<li><strong>Right to Access / Know.</strong> You may have a right to request access to personal information that we hold about you.</li>
<li><strong>Right to Delete.</strong> You may have a right to request that we delete personal information we maintain about you.</li>
<li><strong>Right to Correct.</strong> You may have a right to request that we correct inaccurate personal information we maintain about you.</li>
<li><strong>Right of Portability.</strong> You may have a right to receive a copy of the personal information we hold about you and to request that we transfer it to a third party, in certain circumstances and with certain exceptions.</li>
<li><strong>Managing Communication Preferences.</strong> We may send you promotional emails, and you may opt out of receiving these at any time by using the unsubscribe option displayed in our emails to you. If you opt out, we may still send you non-promotional emails, such as those about your account or orders that you have made.</li>
</ul>
<p>You may exercise any of these rights where indicated on the Services or by contacting us using the contact details provided below. To learn more about how Shopify uses your personal information and any rights you may have, including rights related to data processed by Shopify, you can visit <a href="https://privacy.shopify.com/en">https://privacy.shopify.com/en</a>.</p>
<p>We will not discriminate against you for exercising any of these rights. We may need to verify your identity before we can process your requests, as permitted or required under applicable law. In accordance with applicable laws, you may designate an authorized agent to make requests on your behalf to exercise your rights. Before accepting such a request from an agent, we will require that the agent provide proof you have authorized them to act on your behalf, and we may need you to verify your identity directly with us. We will respond to your request in a timely manner as required under applicable law.</p>
<h2>Complaints</h2>
<p>If you have complaints about how we process your personal information, please contact us using the contact details provided below. Depending on where you live, you may have the right to appeal our decision by contacting us using the contact details set out below, or lodge your complaint with your local data protection authority.</p>
<h2>International Transfers</h2>
<p>Please note that we may transfer, store and process your personal information outside the country you live in.</p>
<p>If we transfer your personal information out of the European Economic Area or the United Kingdom, we will rely on recognized transfer mechanisms like the European Commission's Standard Contractual Clauses, or any equivalent contracts issued by the relevant competent authority of the UK, as relevant, unless the data transfer is to a country that has been determined to provide an adequate level of protection.</p>
<h2>Changes to This Privacy Policy</h2>
<p>We may update this Privacy Policy from time to time, including to reflect changes to our practices or for other operational, legal, or regulatory reasons. We will post the revised Privacy Policy on this website, update the "Last updated" date and provide notice as required by applicable law.</p>
<h2>Contact</h2>
<p>Should you have any questions about our privacy practices or this Privacy Policy, or if you would like to exercise any of the rights available to you, please email us at <a href="mailto:noodlezcollective@gmail.com">noodlezcollective@gmail.com</a>. You can find our other contact details on our <a href="/policies/contact-information">contact information</a> page.</p>
`;

const TERMS_OF_SERVICE = `
<p><strong>Last updated: [Date]</strong></p>

<h2>1. About These Terms</h2>
<p>This website is operated by [Legal Business Name], trading as [Store Name] ("we", "us", "our"). These Terms of Service ("Terms") apply to everyone who visits our website or buys from us ("you", "your"). By using our website or placing an order, you agree to these Terms together with our <a href="/policies/privacy-policy">Privacy Policy</a>, <a href="/policies/refund-policy">Return and Refund Policy</a> and <a href="/policies/shipping-policy">Shipping Policy</a>. If you do not agree, please do not use our website.</p>
<p>Our store is hosted on Shopify, which provides the online platform that allows us to sell our products to you.</p>

<h2>2. Eligibility</h2>
<p>By using this website, you confirm that you are at least 18 years old, or that you are using the website with the consent and supervision of a parent or guardian.</p>

<h2>3. Using Our Website</h2>
<p>You agree not to:</p>
<ul>
<li>Use the website for any unlawful or fraudulent purpose</li>
<li>Upload or transmit viruses or any other harmful code</li>
<li>Attempt to interfere with the security or operation of the website</li>
<li>Copy, reproduce, resell or commercially exploit any part of the website without our written permission</li>
<li>Collect data from the website by automated means without our permission</li>
</ul>
<p>We may suspend or end your access to the website if you break these Terms.</p>

<h2>4. Product Information</h2>
<p>We work hard to describe and photograph our bedding and sleep products accurately. However, please note:</p>
<ul>
<li>Colours and textures may appear slightly different depending on your screen and lighting.</li>
<li>Dimensions, fill weights and thread counts are given as a guide and may vary slightly due to the nature of textiles and filling materials.</li>
<li>Comfort, softness and firmness are personal, and descriptions of how a product feels are general guidance only.</li>
<li>Pillows, duvets and other filled items may be vacuum-packed for delivery and can take up to 48 hours to regain their full shape and loft after unpacking.</li>
<li>Natural fibres can shrink slightly after washing.</li>
</ul>
<p>Please check the size guide and product description before ordering, especially to make sure sheets and covers fit your mattress, duvet and pillows. If a product is not as described, your rights are set out in our Return and Refund Policy.</p>

<h2>5. Care and Use</h2>
<p>To keep your products in the best condition, please follow the care instructions on the product label and product page. We are not responsible for damage caused by washing, drying or using products in a way that does not follow these instructions, or by normal wear and tear over time.</p>
<p>Our products are designed for general household use and comfort. They are not medical devices and are not intended to diagnose, treat or prevent any medical condition, including sleep disorders, allergies or back and neck pain. If you have a medical condition, please seek advice from a healthcare professional. Where materials are described as hypoallergenic, this means they are designed to reduce the likelihood of an allergic reaction; it does not guarantee that a reaction will not occur.</p>

<h2>6. Prices and Payment</h2>
<p>All prices are shown in GBP (£) and include VAT where applicable. Shipping costs are shown at checkout before you pay. We may change our prices at any time, but changes will not affect orders that have already been confirmed.</p>
<p>Payment is taken when you place your order. We accept the payment methods shown at checkout. Payment information is encrypted and processed securely by our payment providers; we do not store your full card details.</p>

<h2>7. Orders</h2>
<p>Placing an order is an offer to buy. A contract between you and us is formed only when we send you an email confirming that your order has been dispatched. We may refuse or cancel an order, for example if a product is out of stock, if there is a pricing or description error, or if we suspect fraud. If we cancel an order you have paid for, we will refund you in full.</p>
<p>We may limit the quantity of products sold per person, household or order.</p>

<h2>8. Accuracy of Information</h2>
<p>We may occasionally make mistakes in product descriptions, pricing or availability. We reserve the right to correct any errors and to update information at any time without prior notice, including after an order has been placed.</p>

<h2>9. Account Information</h2>
<p>You agree to provide accurate, complete and up-to-date information when placing an order or creating an account. You are responsible for keeping your account login details confidential.</p>

<h2>10. Delivery and Returns</h2>
<p>Delivery is covered by our <a href="/policies/shipping-policy">Shipping Policy</a>. Returns, refunds and exchanges are covered by our <a href="/policies/refund-policy">Return and Refund Policy</a>. For hygiene reasons, some filled items such as pillows and duvets can only be returned if they are still in their original sealed packaging.</p>

<h2>11. Intellectual Property</h2>
<p>All content on this website, including text, images, logos and designs, belongs to us or our licensors and is protected by intellectual property laws. You may not use it without our written permission.</p>

<h2>12. Feedback and Reviews</h2>
<p>If you send us reviews, comments or suggestions, you allow us to use, publish and edit them free of charge. You agree that your submissions will not be unlawful, offensive, misleading or infringe anyone else's rights.</p>

<h2>13. Third-Party Links and Tools</h2>
<p>Our website may contain links to, or tools provided by, third parties. We are not responsible for their content, products or privacy practices, and your use of them is at your own risk and subject to their terms.</p>

<h2>14. Personal Information</h2>
<p>We handle your personal information in line with our <a href="/policies/privacy-policy">Privacy Policy</a>.</p>

<h2>15. Our Liability</h2>
<p>Nothing in these Terms limits or excludes our liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot be limited or excluded by law. Your statutory rights as a consumer are not affected.</p>
<p>Subject to the above, we are not liable for any loss that was not reasonably foreseeable, or for any business losses, including loss of profit or loss of data. Our total liability to you in connection with any order is limited to the price you paid for that order.</p>

<h2>16. Indemnity</h2>
<p>You agree to compensate us for any claims, losses or costs that arise from your breach of these Terms or your misuse of our website.</p>

<h2>17. Events Outside Our Control</h2>
<p>We are not responsible for delays or failures caused by events outside our reasonable control, such as carrier disruptions, severe weather, strikes or technical failures.</p>

<h2>18. Severability</h2>
<p>If any part of these Terms is found to be invalid or unenforceable, the rest of the Terms will remain in effect.</p>

<h2>19. Changes to These Terms</h2>
<p>We may update these Terms from time to time by posting a new version on this page. The Terms in force when you place an order will apply to that order.</p>

<h2>20. Governing Law</h2>
<p>These Terms are governed by the laws of England and Wales. If you are a consumer, you may bring proceedings in the courts of England and Wales, or in the courts of the part of the UK where you live.</p>

<h2>21. Contact Us</h2>
<p>[Legal Business Name], trading as [Store Name]<br>
[Business Address]<br>
Email: [Email]<br>
Phone: [Phone]</p>
`;

const SHIPPING_POLICY = `
<p>This policy explains where we deliver, how long delivery takes and how much it costs.</p>

<h2>Where We Ship</h2>
<p>We currently deliver to addresses within the United Kingdom only.</p>

<h2>Processing Time</h2>
<p>Orders placed before 5:00 PM (GMT), Monday to Friday, are processed the same business day. Orders placed after 5:00 PM, at weekends or on UK bank holidays are processed the next business day.</p>
<p>Please allow 1–2 business days for your order to be prepared and packed.</p>

<h2>Delivery Time</h2>
<p>Once dispatched, orders usually arrive within 5–8 business days. In total, you can expect your order to arrive within approximately 6–10 business days of ordering.</p>
<p>Delivery times are estimates and are not guaranteed. Occasional delays can happen during busy periods, bad weather or carrier disruptions.</p>

<h2>Shipping Costs</h2>
<ul>
<li>Standard UK delivery: £3.99</li>
<li>Orders of £50 or more: FREE</li>
</ul>
<p>The shipping cost for your order is shown at checkout before you pay.</p>

<h2>Larger Orders and Multiple Parcels</h2>
<p>Bulky items such as duvets, pillows and mattress toppers take up more space, so orders with several items may be sent in more than one parcel and may arrive on different days. You will receive tracking details for each parcel where available.</p>
<p>Pillows, duvets and other filled items may arrive vacuum-packed or compressed. Once unpacked, please allow up to 48 hours for them to regain their full shape and loft. Some new bedding may have a slight "new product" smell when first unpacked, which will fade after airing.</p>

<h2>Order Tracking</h2>
<p>When your order is dispatched, we will email you a shipping confirmation. Where available, it will include a tracking number so you can follow your parcel on the carrier's website.</p>

<h2>Delivery Issues</h2>
<p>If your parcel is delayed, missing or arrives damaged, please check your tracking details first. If that does not help, contact us at [Email] with your order number and a description of the problem (and photos if the parcel or packaging is damaged). We will work with the carrier to resolve it as quickly as possible.</p>
<p>If your tracking shows your parcel as delivered but you have not received it, please check with neighbours and around your property, then contact us within 7 days of the delivery date.</p>

<h2>Incorrect Addresses and Failed Deliveries</h2>
<p>Please check that your shipping address is correct and complete before placing your order. If you notice a mistake, contact us straight away. We will do our best to update it, but we cannot change an address once the order has been dispatched.</p>
<p>If a parcel is returned to us because of an incorrect address, a refused delivery or because it was not collected, we will contact you to arrange re-delivery. Any extra shipping costs may be charged to you or deducted from your refund.</p>

<h2>Questions</h2>
<p>For any questions about delivery, contact us at [Email] or [Phone].</p>
`;

const CONTACT_INFORMATION = `
<h2>Business Details</h2>
<p><strong>Trading name:</strong> [Store Name]<br>
<strong>Legal business name:</strong> [Legal Business Name]<br>
<strong>Company registration number:</strong> [Company Number]<br>
<strong>VAT number:</strong> [VAT Number, if registered]<br>
<strong>Business address:</strong> [Business Address]</p>

<h2>Get in Touch</h2>
<p><strong>Email:</strong> [Email]<br>
<strong>Phone:</strong> [Phone]</p>

<h2>Customer Service Hours</h2>
<p>[Monday to Friday, 9:00 AM – 5:00 PM (GMT)]</p>
<p>We aim to reply to all emails within 48 hours.</p>
`;

const LEGAL_NOTICE = `
<h2>Website Operator</h2>
<p>This website is operated by [Legal Business Name], trading as [Store Name].</p>
<p>Registered office / business address: [Business Address]<br>
Company registration number: [Company Number]<br>
Registered in: [England and Wales / your country]<br>
VAT number: [VAT Number, if registered]<br>
Director / responsible person: [Full Name]</p>

<h2>Contact</h2>
<p>Email: [Email]<br>
Phone: [Phone]</p>

<h2>Hosting</h2>
<p>This online store is hosted by Shopify Inc., 151 O'Connor Street, Ground Floor, Ottawa, Ontario, K2P 2L8, Canada.</p>

<h2>Intellectual Property</h2>
<p>All content on this website, including text, images, graphics, logos and product designs, is owned by or licensed to [Legal Business Name] and protected by copyright and trademark law. It may not be copied, reproduced or used without our prior written permission.</p>

<h2>Liability for Content</h2>
<p>We take care to keep the information on this website accurate and up to date, but we cannot guarantee that it is always complete or error-free. We are not responsible for the content of external websites linked from this site.</p>

<h2>Complaints</h2>
<p>If you have a complaint, please contact us first at [Email] and we will do our best to resolve it. Your statutory rights are not affected.</p>
`;

/** In the order the policies index lists them. */
export const STOREFRONT_POLICIES: readonly StorefrontPolicy[] = [
  {
    handle: 'privacy-policy',
    title: 'Privacy Policy',
    description: 'How we collect, use and protect your personal information.',
    heroHeadline: "Sleep Easy, Your Data's Safe",
    heroSubheadline:
      'From checkout to sweet dreams, we keep your details private, never shared, always protected.',
    heroImage: {
      url: '/images/placeholders/lifestyle-1.svg',
      altText: 'Customer hugging a Mellow pillow',
      width: 1376,
      height: 760,
    },
    body: PRIVACY_POLICY.trim(),
    shopField: 'privacyPolicy',
  },
  {
    handle: 'shipping-policy',
    title: 'Shipping Policy',
    description: 'Processing times, delivery estimates and tracking.',
    heroHeadline: 'From Our Door To Yours',
    heroSubheadline:
      'Where we deliver, how long it takes and what it costs, in plain language.',
    heroImage: {
      url: '/images/placeholders/lifestyle-2.svg',
      altText: 'A Mellow parcel ready to ship',
      width: 1376,
      height: 760,
    },
    body: SHIPPING_POLICY.trim(),
    shopField: 'shippingPolicy',
  },
  {
    handle: 'terms-of-service',
    title: 'Terms of Service',
    description: 'The terms that apply when you shop with Mellow.',
    heroHeadline: 'Our Terms, Made Simple',
    heroSubheadline: 'Because clarity matters as much as comfort.',
    heroImage: {
      url: '/images/placeholders/lifestyle-1.svg',
      altText: 'Customer hugging a Mellow pillow',
      width: 1376,
      height: 760,
    },
    body: TERMS_OF_SERVICE.trim(),
    shopField: 'termsOfService',
  },
  {
    handle: 'refund-policy',
    title: 'Return and Refund Policy',
    description: 'Our 30-day return window and how refunds and exchanges work.',
    heroHeadline: 'Love It, Or Send It Back',
    heroSubheadline:
      '30 days to decide, no restocking fees and real people to help if anything is wrong.',
    heroImage: {
      url: '/images/placeholders/about-hero.svg',
      altText: 'A stack of Mellow pillows',
      width: 1376,
      height: 760,
    },
    body: REFUND_POLICY.trim(),
    shopField: 'refundPolicy',
  },
  {
    handle: 'contact-information',
    title: 'Contact Information',
    description: 'Business details, how to reach us and when we reply.',
    heroHeadline: "We're Here To Help",
    heroSubheadline:
      'Real people, real replies: how to reach us and when we are around.',
    heroImage: {
      url: '/images/placeholders/lifestyle-2.svg',
      altText: 'The Mellow customer service team',
      width: 1376,
      height: 760,
    },
    body: CONTACT_INFORMATION.trim(),
    shopField: null,
  },
  {
    handle: 'legal-notice',
    title: 'Legal Notice',
    description:
      'Who operates this website, hosting and intellectual property.',
    heroHeadline: 'The Legal Details',
    heroSubheadline:
      'Who operates this website and how your rights are protected.',
    heroImage: {
      url: '/images/placeholders/about-hero.svg',
      altText: 'A stack of Mellow pillows',
      width: 1376,
      height: 760,
    },
    body: LEGAL_NOTICE.trim(),
    shopField: null,
  },
];

/** The storefront document that stands behind a Shopify shop policy field. */
export function getStorefrontPolicyForField(
  field: StorefrontPolicy['shopField'],
): StorefrontPolicy | undefined {
  return field
    ? STOREFRONT_POLICIES.find((policy) => policy.shopField === field)
    : undefined;
}

export function getStorefrontPolicy(
  handle: string | undefined,
): StorefrontPolicy | undefined {
  return STOREFRONT_POLICIES.find((policy) => policy.handle === handle);
}
