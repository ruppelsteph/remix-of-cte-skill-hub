-- Strip HTML and decode common entities from categories.description
UPDATE public.categories
SET description = NULLIF(
  btrim(
    regexp_replace(
      replace(
        replace(
          replace(
            replace(
              replace(
                replace(
                  replace(
                    replace(
                      replace(
                        replace(
                          replace(
                            replace(
                              replace(
                                replace(
                                  regexp_replace(description, '<[^>]+>', ' ', 'g'),
                                  '&nbsp;', ' '
                                ),
                                '&amp;', '&'
                              ),
                              '&lt;', '<'
                            ),
                            '&gt;', '>'
                          ),
                          '&quot;', '"'
                        ),
                        '&#39;', ''''
                      ),
                      '&apos;', ''''
                    ),
                    '&rsquo;', ''''
                  ),
                  '&lsquo;', ''''
                ),
                '&rdquo;', '"'
              ),
              '&ldquo;', '"'
            ),
            '&ndash;', '-'
          ),
          '&mdash;', '-'
        ),
        '&hellip;', '...'
      ),
      '\s+', ' ', 'g'
    )
  ),
  ''
)
WHERE description IS NOT NULL
  AND (description ~ '<[^>]+>' OR description ~ '&[a-zA-Z#0-9]+;');