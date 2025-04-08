import type { Schema, Struct } from '@strapi/strapi';

export interface CommonsAboutSection extends Struct.ComponentSchema {
  collectionName: 'components_commons_about_sections';
  info: {
    description: '';
    displayName: 'AboutSection';
  };
  attributes: {
    description: Schema.Attribute.Text;
    images: Schema.Attribute.Media<'images' | 'files' | 'videos', true>;
    subtitle: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface CommonsFormSection extends Struct.ComponentSchema {
  collectionName: 'components_commons_form_sections';
  info: {
    displayName: 'FormSection';
    icon: 'shield';
  };
  attributes: {
    image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    title: Schema.Attribute.String;
  };
}

export interface CommonsGridCards extends Struct.ComponentSchema {
  collectionName: 'components_commons_grid_cards';
  info: {
    displayName: 'gridCards';
  };
  attributes: {
    articles: Schema.Attribute.Relation<'oneToMany', 'api::article.article'>;
    subtitle: Schema.Attribute.String;
    title: Schema.Attribute.String;
  };
}

export interface CommonsIconSectionBanner extends Struct.ComponentSchema {
  collectionName: 'components_commons_icon_section_banners';
  info: {
    description: '';
    displayName: 'IconSectionBanner';
  };
  attributes: {
    button: Schema.Attribute.Component<'utils.button', false>;
    description: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.SetMinMaxLength<{
        minLength: 40;
      }>;
    iconsInfo: Schema.Attribute.Component<'utils.icon-info', true>;
    image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'> &
      Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface CommonsSectionCardsRecommended extends Struct.ComponentSchema {
  collectionName: 'components_commons_section_cards_recommendeds';
  info: {
    description: '';
    displayName: 'SectionCardsRecommended';
    icon: 'gate';
  };
  attributes: {
    articles: Schema.Attribute.Relation<'oneToMany', 'api::article.article'>;
    button: Schema.Attribute.Component<'utils.button', false>;
    description: Schema.Attribute.String;
    title: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface CommonsTransferInformation extends Struct.ComponentSchema {
  collectionName: 'components_commons_transfer_informations';
  info: {
    description: '';
    displayName: 'TransferInformation';
  };
  attributes: {
    description: Schema.Attribute.String;
    subtitle: Schema.Attribute.String;
    table_information: Schema.Attribute.Relation<
      'oneToOne',
      'api::table-information.table-information'
    >;
    title: Schema.Attribute.String;
  };
}

export interface SharedMedia extends Struct.ComponentSchema {
  collectionName: 'components_shared_media';
  info: {
    displayName: 'Media';
    icon: 'file-video';
  };
  attributes: {
    file: Schema.Attribute.Media<'images' | 'files' | 'videos'>;
  };
}

export interface SharedQuote extends Struct.ComponentSchema {
  collectionName: 'components_shared_quotes';
  info: {
    displayName: 'Quote';
    icon: 'indent';
  };
  attributes: {
    body: Schema.Attribute.Text;
    title: Schema.Attribute.String;
  };
}

export interface SharedRichText extends Struct.ComponentSchema {
  collectionName: 'components_shared_rich_texts';
  info: {
    description: '';
    displayName: 'Rich text';
    icon: 'align-justify';
  };
  attributes: {
    body: Schema.Attribute.RichText;
  };
}

export interface SharedSeo extends Struct.ComponentSchema {
  collectionName: 'components_shared_seos';
  info: {
    description: '';
    displayName: 'Seo';
    icon: 'allergies';
    name: 'Seo';
  };
  attributes: {
    metaDescription: Schema.Attribute.Text & Schema.Attribute.Required;
    metaTitle: Schema.Attribute.String & Schema.Attribute.Required;
    shareImage: Schema.Attribute.Media<'images'>;
  };
}

export interface SharedSlider extends Struct.ComponentSchema {
  collectionName: 'components_shared_sliders';
  info: {
    description: '';
    displayName: 'Slider';
    icon: 'address-book';
  };
  attributes: {
    files: Schema.Attribute.Media<'images', true>;
  };
}

export interface UtilsArticleServices extends Struct.ComponentSchema {
  collectionName: 'components_utils_article_services';
  info: {
    displayName: 'ArticleServices';
    icon: 'attachment';
  };
  attributes: {
    description: Schema.Attribute.RichText;
    title: Schema.Attribute.String;
  };
}

export interface UtilsButton extends Struct.ComponentSchema {
  collectionName: 'components_utils_buttons';
  info: {
    displayName: 'Button';
  };
  attributes: {
    text: Schema.Attribute.String;
    type: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface UtilsFooter extends Struct.ComponentSchema {
  collectionName: 'components_utils_footers';
  info: {
    description: '';
    displayName: 'Footer';
  };
  attributes: {
    copyright: Schema.Attribute.String;
  };
}

export interface UtilsHero extends Struct.ComponentSchema {
  collectionName: 'components_utils_heroes';
  info: {
    description: '';
    displayName: 'Hero';
    icon: 'bold';
  };
  attributes: {
    button: Schema.Attribute.Component<'utils.button', false>;
    description: Schema.Attribute.String;
    image: Schema.Attribute.Media<'images' | 'files' | 'videos'> &
      Schema.Attribute.Required;
    size: Schema.Attribute.String & Schema.Attribute.DefaultTo<'big'>;
    title: Schema.Attribute.String;
  };
}

export interface UtilsIconInfo extends Struct.ComponentSchema {
  collectionName: 'components_utils_icon_infos';
  info: {
    displayName: 'IconInfo';
  };
  attributes: {
    description: Schema.Attribute.String;
    icon: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    title: Schema.Attribute.String;
  };
}

export interface UtilsLink extends Struct.ComponentSchema {
  collectionName: 'components_utils_links';
  info: {
    description: '';
    displayName: 'link';
    icon: 'alien';
  };
  attributes: {
    name: Schema.Attribute.String;
    text: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface UtilsMenuButton extends Struct.ComponentSchema {
  collectionName: 'components_utils_menu_buttons';
  info: {
    description: '';
    displayName: 'IconButton';
  };
  attributes: {
    logo: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'>;
    name: Schema.Attribute.String;
    text: Schema.Attribute.String;
    url: Schema.Attribute.String;
  };
}

export interface UtilsTest extends Struct.ComponentSchema {
  collectionName: 'components_utils_tests';
  info: {
    displayName: 'test';
  };
  attributes: {
    body2: Schema.Attribute.JSON;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'commons.about-section': CommonsAboutSection;
      'commons.form-section': CommonsFormSection;
      'commons.grid-cards': CommonsGridCards;
      'commons.icon-section-banner': CommonsIconSectionBanner;
      'commons.section-cards-recommended': CommonsSectionCardsRecommended;
      'commons.transfer-information': CommonsTransferInformation;
      'shared.media': SharedMedia;
      'shared.quote': SharedQuote;
      'shared.rich-text': SharedRichText;
      'shared.seo': SharedSeo;
      'shared.slider': SharedSlider;
      'utils.article-services': UtilsArticleServices;
      'utils.button': UtilsButton;
      'utils.footer': UtilsFooter;
      'utils.hero': UtilsHero;
      'utils.icon-info': UtilsIconInfo;
      'utils.link': UtilsLink;
      'utils.menu-button': UtilsMenuButton;
      'utils.test': UtilsTest;
    }
  }
}
