-- 043_profile_banner
-- Profile page banner: which of the user's five favourites backs the banner,
-- and how it is cropped. Both nullable — NULL position = the first favourite,
-- NULL crop = the image's centre. Purely additive; `profile_update_own` RLS
-- already covers the whole row and the 010 sensitive-column guard only touches
-- role/referral_code.

ALTER TABLE public.profile
  ADD COLUMN IF NOT EXISTS banner_favourite_position SMALLINT
    CHECK (banner_favourite_position IS NULL OR banner_favourite_position BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS banner_crop JSONB
    CHECK (
      banner_crop IS NULL
      OR (
        jsonb_typeof(banner_crop) = 'object'
        AND jsonb_typeof(banner_crop->'x') = 'number'
        AND jsonb_typeof(banner_crop->'y') = 'number'
        AND jsonb_typeof(banner_crop->'width') = 'number'
        AND jsonb_typeof(banner_crop->'height') = 'number'
      )
    );

COMMENT ON COLUMN public.profile.banner_favourite_position IS 'profile_favourite.position (1-5) whose artwork backs the profile banner; NULL = first favourite';
COMMENT ON COLUMN public.profile.banner_crop IS 'react-easy-crop croppedArea in percent of the source image: {x, y, width, height}; NULL = centred';
